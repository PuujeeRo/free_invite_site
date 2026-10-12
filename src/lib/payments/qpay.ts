import { getSiteUrl } from "@/lib/site-url";
import type {
  CheckoutDeeplink,
  CheckoutPayload,
  CreateInvoiceParams,
  CreateInvoiceResult,
  PaymentProvider,
} from "./types";

// QPay Simple/v2 merchant API integration.
//
// Follows QPay's publicly documented v2 REST shape (POST /auth/token,
// POST /invoice, POST /payment/check). QPay does not publish a versioned
// OpenAPI spec and has renamed fields between merchant integrations before, so
// every field read off a response here is read defensively: the invoice parser
// accepts both the snake_case and the qPay_-prefixed spellings that merchants
// have reported seeing, and treats anything it cannot find as absent rather
// than throwing. Verify against a live sandbox invoice before going live.
const QPAY_BASE_URL = process.env.QPAY_BASE_URL ?? "https://merchant.qpay.mn/v2";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

// QPay issues these as a "username" and "password" and that is what their docs
// and merchant onboarding call them, but this codebase originally named them
// CLIENT_ID/CLIENT_SECRET. Both spellings are accepted so an existing deploy
// does not break, with QPay's own naming taking precedence.
export function qpayCredentials(): { username: string; password: string } | null {
  const username = process.env.QPAY_USERNAME ?? process.env.QPAY_CLIENT_ID;
  const password = process.env.QPAY_PASSWORD ?? process.env.QPAY_CLIENT_SECRET;
  if (!username || !password) return null;
  return { username, password };
}

// In-memory token cache. Fine for a single long-lived server process; on
// serverless it just re-authenticates on a cold start, which is harmless.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const credentials = qpayCredentials();
  if (!credentials) {
    throw new Error("Missing QPAY_USERNAME / QPAY_PASSWORD");
  }
  const basicAuth = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");

  const res = await fetch(`${QPAY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}` },
    cache: "no-store",
  });
  if (!res.ok) {
    // Never cache a failed auth: a stale null token would otherwise wedge every
    // later call behind the same expired credential.
    cachedToken = null;
    throw new Error(`QPay auth failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: expiryToEpochMs(json.expires_in),
  };
  return cachedToken.accessToken;
}

// QPay's `expires_in` is not a duration despite the OAuth-style name: a live
// merchant token comes back as an absolute Unix timestamp in seconds (verified
// against merchant.qpay.mn -- see scripts/verify-qpay.ts). Treating it as a
// duration puts the cache expiry tens of thousands of years out, so the token
// is never refreshed and every call 401s permanently once QPay expires it for
// real. Values small enough to be a duration are still honoured, in case QPay
// changes it back or a sandbox behaves differently.
const EPOCH_SECONDS_THRESHOLD = 1_000_000_000; // ~2001; no sane duration is this large
const DEFAULT_TOKEN_TTL_SECONDS = 3600;

export function expiryToEpochMs(expiresIn: number | undefined, now = Date.now()): number {
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return now + DEFAULT_TOKEN_TTL_SECONDS * 1000;
  }
  if (expiresIn >= EPOCH_SECONDS_THRESHOLD) {
    return expiresIn * 1000; // absolute Unix timestamp
  }
  return now + expiresIn * 1000; // duration in seconds
}

// QPay's invoice response, in every spelling merchants have reported.
type QPayInvoiceResponse = {
  invoice_id?: string;
  qr_text?: string;
  qr_image?: string;
  qPay_QRcode?: string;
  qPay_QRimage?: string;
  qPay_shortUrl?: string;
  urls?: unknown;
};

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

// QPay has returned `urls` both as an array of {name, link} and as an object
// keyed by bank name. Normalise both into one list, and drop anything without a
// usable link rather than rendering a dead button.
function parseDeeplinks(urls: unknown): CheckoutDeeplink[] {
  const entries = Array.isArray(urls)
    ? urls
    : urls && typeof urls === "object"
      ? Object.values(urls as Record<string, unknown>)
      : [];

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const link = firstString(row.link, row.url, row.deeplink);
    if (!link) return [];
    return [
      {
        name: firstString(row.name, row.description) ?? "Bank app",
        description: firstString(row.description) ?? undefined,
        logo: firstString(row.logo) ?? undefined,
        link,
      },
    ];
  });
}

export class QPayProvider implements PaymentProvider {
  name = "qpay" as const;
  readonly currency = "MNT";

  async createInvoice({
    paymentId,
    amount,
    description,
  }: CreateInvoiceParams): Promise<CreateInvoiceResult> {
    const token = await getAccessToken();
    const invoiceCode = requireEnv("QPAY_INVOICE_CODE");

    const res = await fetch(`${QPAY_BASE_URL}/invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        invoice_code: invoiceCode,
        sender_invoice_no: paymentId,
        invoice_receiver_code: process.env.QPAY_INVOICE_RECEIVER_CODE ?? "terminal",
        invoice_description: description,
        amount,
        callback_url: `${getSiteUrl()}/api/payments/qpay/webhook?payment_id=${paymentId}`,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `QPay invoice creation failed: ${res.status} ${await res.text().catch(() => "")}`
      );
    }

    const json = (await res.json()) as QPayInvoiceResponse;
    if (!json.invoice_id) {
      throw new Error("QPay invoice response did not include an invoice_id");
    }

    const checkout: CheckoutPayload = {
      qrImage: firstString(json.qr_image, json.qPay_QRimage),
      qrText: firstString(json.qr_text, json.qPay_QRcode),
      shortUrl: firstString(json.qPay_shortUrl),
      deeplinks: parseDeeplinks(json.urls),
    };

    // A QPay invoice with no QR, no deeplinks and no short URL is unpayable, so
    // fail here rather than sending the organizer to an empty checkout page.
    if (!checkout.qrImage && !checkout.qrText && !checkout.shortUrl && !checkout.deeplinks?.length) {
      throw new Error("QPay invoice response contained no QR, deeplinks or short URL");
    }

    // Deliberately our own page, not QPay's short URL: the payer stays on the
    // site, sees the QR and their own bank's button together, and the page polls
    // for confirmation so the upgrade unlocks without a manual refresh. The
    // short URL is kept inside `checkout` as a fallback link.
    return {
      providerRef: json.invoice_id,
      checkoutUrl: `${getSiteUrl()}/pay/qpay/${paymentId}`,
      checkout,
    };
  }

  // Called from the webhook handler and the checkout page's polling endpoint to
  // confirm a payment actually happened. QPay's callback ping isn't
  // authenticated, so it's only ever a signal to re-check, never trusted alone.
  async isInvoicePaid(invoiceId: string): Promise<boolean> {
    const token = await getAccessToken();
    const res = await fetch(`${QPAY_BASE_URL}/payment/check`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        object_type: "INVOICE",
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 },
      }),
    });

    if (!res.ok) return false;

    const json = (await res.json()) as { rows?: { payment_status?: string }[] };
    return (json.rows ?? []).some((row) => row.payment_status === "PAID");
  }
}
