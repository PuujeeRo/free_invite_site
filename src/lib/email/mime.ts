// Builds the raw message the Gmail API sends, and the "compose" links that
// open a pre-filled draft in the organizer's own mail program. No network and
// no secrets here, so scripts/verify-links.ts can exercise all of it.

// Deliberately strict. This value is written into a message header, where a
// line break would let a crafted address add headers of its own (a Bcc to a
// spam list, say). Anything unusual is refused rather than escaped.
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})+$/;

export function isPlainEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

// A header may only carry ASCII, so anything else (every Mongolian subject) is
// sent as RFC 2047 "encoded words". Each word may be at most 75 characters and
// must hold whole characters, hence the chunking by character, not by byte.
export function encodeHeader(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ");
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;

  const words: string[] = [];
  let chunk = "";
  for (const char of clean) {
    if (Buffer.byteLength(chunk + char, "utf8") > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`).join("\r\n ");
}

function base64Body(value: string): string {
  return (Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

/** A multipart/alternative message (plain text and HTML), or null if `to` is not a plain address. */
export function buildMimeMessage(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  boundary?: string; // fixed in tests; random otherwise
}): string | null {
  if (!isPlainEmail(params.to)) return null;
  const boundary = params.boundary ?? `naashir-${crypto.randomUUID()}`;
  // No From header: Gmail fills in the account the access token belongs to,
  // which is the only address it would accept anyway.
  return [
    `To: ${params.to}`,
    `Subject: ${encodeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(params.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(params.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/**
 * Links that open a draft with the invitation already written, for the
 * organizer to send themselves: one for Gmail in the browser, one `mailto:`
 * for whatever mail program the device uses. Nothing passes through this
 * site, so there is no sending limit and no account to connect. Null when the
 * guest's address is not one we would put in a link.
 */
export function buildComposeLinks(params: {
  to: string;
  subject: string;
  body: string;
}): { gmail: string; mailto: string } | null {
  if (!isPlainEmail(params.to)) return null;
  const gmail = new URL("https://mail.google.com/mail/");
  gmail.search = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: params.to,
    su: params.subject,
    body: params.body,
  }).toString();
  // mailto: wants %20 for spaces and CRLF line breaks; URLSearchParams would
  // write "+", which some mail programs show literally.
  const query = `subject=${encodeURIComponent(params.subject)}&body=${encodeURIComponent(
    params.body.replace(/\r?\n/g, "\r\n")
  )}`;
  return { gmail: gmail.toString(), mailto: `mailto:${params.to}?${query}` };
}
