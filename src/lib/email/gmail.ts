import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { buildMimeMessage } from "./mime";
import type { EmailProvider, SendInviteParams } from "./types";

// Sending invitation emails from the organizer's own Gmail account.
//
// Optional twice over: the whole feature is off until a Google OAuth client is
// configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET), and then each
// organizer chooses whether to connect. Not connected, emails go out through
// the site's own sender exactly as before.
//
// The one permission asked for is gmail.send: the site can send as the
// organizer and cannot read, list or delete anything in their mailbox.
//
// Google treats gmail.send as a sensitive scope. Until the OAuth app has
// passed Google's verification it works only for accounts listed as test
// users (up to 100) and shows a warning screen -- see the README.
const SCOPES = "openid email https://www.googleapis.com/auth/gmail.send";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Holds the anti-forgery state between /api/google/connect and its callback.
export const GMAIL_STATE_COOKIE = "naashir_gmail_state";

export function gmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && tokenKey());
}

function redirectUri(): string {
  return `${getSiteUrl()}/api/google/callback`;
}

// ---- keeping the refresh token ----

// A dedicated secret if one is set, otherwise derived from the service-role
// key, which the server must have anyway. Either way it lives only in the
// environment, never in the database beside the tokens it protects.
function tokenKey(): Buffer | null {
  const secret = process.env.GMAIL_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret ? createHash("sha256").update(`naashir-gmail:${secret}`).digest() : null;
}

export function encryptToken(plain: string, key = tokenKey()): string {
  if (!key) throw new Error("No key to encrypt the Gmail token with");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

/** Null when the value was not written by encryptToken with this key (tampered, or the key changed). */
export function decryptToken(stored: string, key = tokenKey()): string | null {
  if (!key) return null;
  try {
    const [iv, tag, body] = stored.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---- connecting ----

export function googleConsentUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    // offline + consent: without both Google returns no refresh token on a
    // second connection, and there would be nothing to send with later.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  }).toString();
  return url.toString();
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };
  return { ok: res.ok, ...json };
}

/** Finishes the consent redirect: stores the connection for this organizer. */
export async function completeGmailConnection(
  organizerId: string,
  code: string
): Promise<"connected" | "no_send_permission" | "failed"> {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!tokens.ok || !tokens.access_token || !tokens.refresh_token) return "failed";
  // The consent screen lets people untick individual permissions.
  if (!tokens.scope?.includes("gmail.send")) return "no_send_permission";

  const profile = (await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)) as { email?: string } | null;
  if (!profile?.email) return "failed";

  const { error } = await createAdminClient()
    .from("gmail_connections")
    .upsert({
      organizer_id: organizerId,
      email: profile.email,
      refresh_token_enc: encryptToken(tokens.refresh_token),
      connected_at: new Date().toISOString(),
    });
  return error ? "failed" : "connected";
}

export interface GmailConnection {
  email: string;
  refreshToken: string;
}

/** The organizer's connection, or null (not connected, feature off, or the table is not there yet). */
export async function getGmailConnection(organizerId: string): Promise<GmailConnection | null> {
  if (!gmailConfigured()) return null;
  try {
    const { data } = await createAdminClient()
      .from("gmail_connections")
      .select("email, refresh_token_enc")
      .eq("organizer_id", organizerId)
      .maybeSingle();
    const refreshToken = data ? decryptToken(data.refresh_token_enc) : null;
    return data && refreshToken ? { email: data.email, refreshToken } : null;
  } catch {
    return null;
  }
}

/** Removes the connection here and asks Google to revoke the grant. */
export async function disconnectGmail(organizerId: string): Promise<void> {
  const connection = await getGmailConnection(organizerId);
  await createAdminClient().from("gmail_connections").delete().eq("organizer_id", organizerId);
  if (connection) {
    // Best effort: the row is already gone, so the site can no longer send
    // either way. The organizer can also revoke from their Google account.
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: connection.refreshToken }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  }
}

// ---- sending ----

export class GmailEmailProvider implements EmailProvider {
  name = "gmail" as const;
  // Set when Google rejects the stored grant (revoked from the Google account,
  // or expired): the organizer has to connect again, which is a different
  // message from "sending failed, try again".
  needsReconnect = false;

  constructor(private connection: GmailConnection) {}

  async send({ to, subject, html, text }: SendInviteParams): Promise<{ ok: boolean }> {
    const raw = buildMimeMessage({ to, subject, text, html });
    if (!raw) return { ok: false };

    try {
      const tokens = await tokenRequest({
        refresh_token: this.connection.refreshToken,
        grant_type: "refresh_token",
      });
      if (!tokens.access_token) {
        this.needsReconnect = tokens.error === "invalid_grant";
        return { ok: false };
      }

      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
      });
      if (res.status === 401 || res.status === 403) this.needsReconnect = true;
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }
}
