/**
 * Probes the real QPay merchant API with the credentials in .env.local.
 *
 * QPay publishes no versioned OpenAPI spec and has renamed response fields
 * between merchant integrations, so the only reliable way to know what the
 * integration will actually receive is to ask the live API and look. This
 * script authenticates, creates one invoice, prints the response's shape (keys
 * and value types, never the credentials), and checks its payment status.
 *
 * The invoice it creates is real but unpaid, which has no financial effect. Run
 * it against QPAY_BASE_URL pointed at a sandbox host when one is available.
 *
 *   npx tsx scripts/verify-qpay.ts
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expiryToEpochMs } from "../src/lib/payments/qpay";

// Minimal .env.local loader: this script deliberately does not boot Next.js, so
// nothing else is loading the file for it.
function loadEnv(path: string) {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["'],?$/g, "");
    if (value) process.env[match[1]] ??= value;
  }
}

loadEnv(".env.local");

const BASE_URL = process.env.QPAY_BASE_URL ?? "https://merchant.qpay.mn/v2";
const USERNAME = process.env.QPAY_USERNAME ?? process.env.QPAY_CLIENT_ID;
const PASSWORD = process.env.QPAY_PASSWORD ?? process.env.QPAY_CLIENT_SECRET;
const INVOICE_CODE = process.env.QPAY_INVOICE_CODE;

let failures = 0;

function pass(message: string) {
  console.log(`  ok    ${message}`);
}

function fail(message: string, detail?: unknown) {
  failures += 1;
  console.log(`  FAIL  ${message}`);
  if (detail !== undefined) console.log(`        ${String(detail).slice(0, 400)}`);
}

// Prints the shape of a response without printing anything sensitive: long
// strings (QR blobs, tokens) are reported as a type and a length only.
function describe(value: unknown, indent = "        "): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[] (empty)";
    return `array(${value.length}) of:\n${indent}  ${describe(value[0], indent + "  ")}`;
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => {
        if (typeof val === "string") {
          return val.length > 60 ? `${key}: string(${val.length} chars)` : `${key}: "${val}"`;
        }
        if (val && typeof val === "object") {
          return `${key}: ${describe(val, indent + "  ")}`;
        }
        return `${key}: ${JSON.stringify(val)}`;
      })
      .join(`\n${indent}`);
  }
  return JSON.stringify(value);
}

async function main() {
  console.log(`QPay probe against ${BASE_URL}`);
  console.log(`  username: ${USERNAME ?? "(missing)"}`);
  console.log(`  invoice code: ${INVOICE_CODE ?? "(missing)"}\n`);

  if (!USERNAME || !PASSWORD || !INVOICE_CODE) {
    fail("credentials missing -- set QPAY_USERNAME / QPAY_PASSWORD / QPAY_INVOICE_CODE");
    process.exit(1);
  }

  // ---------- 1. auth ----------
  console.log("1. POST /auth/token");
  const basicAuth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
  const authRes = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}` },
  });

  const authBody = await authRes.text();
  if (!authRes.ok) {
    fail(`auth returned ${authRes.status}`, authBody);
    process.exit(1);
  }

  let auth: { access_token?: string; expires_in?: number };
  try {
    auth = JSON.parse(authBody);
  } catch {
    fail("auth response was not JSON", authBody);
    process.exit(1);
  }

  if (!auth.access_token) {
    fail("auth response had no access_token", describe(auth));
    process.exit(1);
  }
  pass(`authenticated, token ${auth.access_token.length} chars`);
  console.log(`        response keys: ${Object.keys(auth).join(", ")}`);

  // The reason this probe exists. QPay's `expires_in` is an absolute Unix
  // timestamp, not the duration its OAuth-style name implies, so assert that
  // the provider's interpretation of it lands somewhere believable.
  const expiresAt = expiryToEpochMs(auth.expires_in);
  const hoursOut = (expiresAt - Date.now()) / 3_600_000;
  console.log(`        expires_in raw: ${auth.expires_in} -> ${new Date(expiresAt).toISOString()}`);
  if (hoursOut > 0 && hoursOut < 24 * 30) {
    pass(`token expiry parsed as ${hoursOut.toFixed(1)}h out`);
  } else {
    fail(`token expiry parsed as ${hoursOut.toFixed(1)}h out; the provider would cache the token wrong`);
  }
  console.log();

  const token = auth.access_token;

  // ---------- 2. create an invoice ----------
  console.log("2. POST /invoice");
  const paymentId = randomUUID();
  const invoiceRes = await fetch(`${BASE_URL}/invoice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      invoice_code: INVOICE_CODE,
      sender_invoice_no: paymentId,
      invoice_receiver_code: process.env.QPAY_INVOICE_RECEIVER_CODE ?? "terminal",
      invoice_description: "Naashir connectivity probe",
      amount: 10,
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/payments/qpay/webhook?payment_id=${paymentId}`,
    }),
  });

  const invoiceBody = await invoiceRes.text();
  if (!invoiceRes.ok) {
    fail(`invoice creation returned ${invoiceRes.status}`, invoiceBody);
    process.exit(1);
  }

  const invoice = JSON.parse(invoiceBody) as Record<string, unknown>;
  pass(`invoice created (sender_invoice_no ${paymentId})`);
  console.log(`        top-level keys: ${Object.keys(invoice).join(", ")}`);
  console.log(`        ${describe(invoice)}\n`);

  // ---------- 3. what the checkout page will actually get ----------
  console.log("3. Fields the checkout page reads");
  const qrImage = invoice.qr_image ?? invoice.qPay_QRimage;
  const qrText = invoice.qr_text ?? invoice.qPay_QRcode;
  const shortUrl = invoice.qPay_shortUrl;
  const urls = invoice.urls;

  if (qrImage) pass(`QR image present (${String(qrImage).length} chars of base64)`);
  else fail("no QR image");

  if (qrText) pass(`QR text present (${String(qrText).length} chars)`);
  else fail("no QR text");

  if (shortUrl) pass(`short URL: ${String(shortUrl)}`);
  else console.log("  --    no short URL (optional)");

  if (Array.isArray(urls)) {
    pass(`${urls.length} bank deeplinks, as an array`);
    for (const entry of urls as Record<string, unknown>[]) {
      console.log(`        ${entry.name ?? entry.description}: ${String(entry.link ?? "").slice(0, 48)}...`);
    }
  } else if (urls && typeof urls === "object") {
    const values = Object.values(urls as Record<string, unknown>);
    pass(`${values.length} bank deeplinks, as an object (the parser normalises this)`);
  } else {
    fail("no bank deeplinks in `urls`");
  }
  console.log();

  // ---------- 4. payment check ----------
  console.log("4. POST /payment/check");
  const checkRes = await fetch(`${BASE_URL}/payment/check`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoice.invoice_id,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });

  const checkBody = await checkRes.text();
  if (!checkRes.ok) {
    fail(`payment check returned ${checkRes.status}`, checkBody);
  } else {
    const check = JSON.parse(checkBody) as { count?: number; rows?: unknown[] };
    pass(`payment check reachable, ${check.rows?.length ?? 0} payment rows (0 is correct, nobody paid it)`);
    console.log(`        response keys: ${Object.keys(check).join(", ")}`);
  }

  // ---------- 5. clean up ----------
  // The probe invoice is real. Retire it so repeated runs do not leave a trail
  // of unpaid invoices in the merchant account.
  console.log("\n5. DELETE /invoice/{id}");
  const deleteRes = await fetch(`${BASE_URL}/invoice/${invoice.invoice_id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (deleteRes.ok) {
    pass("probe invoice deleted");
  } else {
    console.log(`  --    could not delete probe invoice (${deleteRes.status}); harmless, it is unpaid`);
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("probe crashed:", err);
  process.exit(1);
});
