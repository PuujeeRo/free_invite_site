import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getSupabaseUrl } from "./env";

// Real-Supabase-Auth (GoTrue) replacement for local dev only: GoTrue has no
// Windows binary and there is no Go toolchain here to build one, so this app
// runs against a natively-run PostgREST instead (see supabase/localdev/README).
// PostgREST still enforces the real RLS policies from a real signed JWT --
// verified end-to-end against a live PostgREST instance while building this,
// including that a spoofed organizer_id is genuinely rejected (403) -- what's
// missing is only GoTrue itself: no magic-link email, no session refresh, no
// /auth/v1/* endpoints. This module is a minimal stand-in for exactly that gap.
//
// Every export here is inert unless LOCAL_DEV_MODE=true. The production code
// path (src/lib/supabase/server.ts using @supabase/ssr against a real Supabase
// project) is untouched by any of this.

export const LOCAL_DEV_SESSION_COOKIE = "naashir_localdev_session";

export function isLocalDevMode(): boolean {
  return process.env.LOCAL_DEV_MODE === "true";
}

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing SUPABASE_JWT_SECRET. Required when LOCAL_DEV_MODE=true -- see .env.local.");
  }
  return new Uint8Array(Buffer.from(secret, "base64"));
}

// Same claims shape a real Supabase JWT carries (sub + role), signed with the
// same secret PostgREST's jwt-secret is configured with (see .localdev/postgrest.conf)
// -- PostgREST verifies and role-switches on this exactly as it would a real one.
export async function mintLocalDevToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecretKey());
}

async function verifyLocalDevToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return typeof payload.sub === "string" ? { sub: payload.sub } : null;
  } catch {
    return null; // expired, tampered, or signed with a since-rotated secret
  }
}

function toSupabaseUser(id: string): User {
  // Only the fields TypeScript's User type actually requires; every call site
  // in this app reads at most .id and .email from the result.
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
    email: undefined,
  };
}

export async function readLocalDevSession(): Promise<{ id: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(LOCAL_DEV_SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyLocalDevToken(token);
  return claims ? { id: claims.sub } : null;
}

export async function setLocalDevSession(userId: string): Promise<void> {
  const token = await mintLocalDevToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(LOCAL_DEV_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearLocalDevSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(LOCAL_DEV_SESSION_COOKIE);
}

// Retries a request once when the connection is reset before any response
// arrives.
//
// In local dev, supabase-js talks to NEXT_PUBLIC_SUPABASE_URL (the Next server)
// and a rewrite forwards /rest/v1/* to PostgREST (see next.config.ts). Both hops
// pool keep-alive connections, and PostgREST closes idle ones on its own
// schedule, so a request that picks a socket the other end has just closed dies
// with ECONNRESET ("socket hang up") before it is ever sent. Retrying gets a
// fresh connection and succeeds.
//
// Safe to retry blindly here because the failure is "never reached the server":
// no response, no side effect. A reset mid-response is NOT retried -- that one
// may have committed a write, so it is surfaced to the caller instead.
//
// Local-dev only. Against a real Supabase project there is no rewrite hop, and
// this module is inert anyway.
async function retryingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (!isConnectionReset(err)) throw err;
    return await fetch(input, init);
  }
}

function isConnectionReset(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 4; depth += 1) {
    const candidate = e as { code?: string; message?: string; cause?: unknown };
    if (candidate.code === "ECONNRESET" || candidate.code === "UND_ERR_SOCKET") return true;
    if (typeof candidate.message === "string" && candidate.message.includes("socket hang up")) {
      return true;
    }
    e = candidate.cause;
  }
  return false;
}

// Drop-in for createClient() in server.ts: same Database-typed SupabaseClient
// shape, so every existing call site (`.from(...)`, `.auth.getUser()`,
// `.auth.signOut()`) works completely unchanged regardless of which mode is
// active. Only .auth.getUser and .auth.signOut are overridden -- confirmed via
// `grep -rn "\.auth\.\w*("` that no other .auth.* method is called on a server
// client anywhere in this app (signInWithOtp is browser-only and
// exchangeCodeForSession is GoTrue-callback-only; local dev's login page
// bypasses both rather than emulating them).
export async function createLocalDevServerClient(): Promise<SupabaseClient<Database>> {
  const session = await readLocalDevSession();
  const token = session ? await mintLocalDevToken(session.id) : "";

  const client = createSupabaseClient<Database>(getSupabaseUrl(), token || "anon", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: retryingFetch,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    },
  });

  client.auth.getUser = (async () => {
    if (!session) return { data: { user: null }, error: null };
    return { data: { user: toSupabaseUser(session.id) }, error: null };
  }) as SupabaseClient<Database>["auth"]["getUser"];

  client.auth.signOut = (async () => {
    await clearLocalDevSession();
    return { error: null };
  }) as SupabaseClient<Database>["auth"]["signOut"];

  return client;
}
