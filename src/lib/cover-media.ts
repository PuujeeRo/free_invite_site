// Single source of truth for what may be uploaded as an invitation cover.
// Imported by the client forms (to set `accept` and give instant feedback) AND
// by the server actions (which are the actual gate -- see validateCoverFile).

export type CoverMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export const COVER_MIME_TYPES: readonly CoverMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// GIF gets a bigger allowance than the still formats on purpose: an animated
// GIF carries every frame uncompressed-ish, so even a short, modestly sized
// loop runs several MB where the same image as a JPEG/WebP would be well under
// one. A single shared limit would either reject ordinary GIFs or wave through
// needlessly huge stills.
export const MAX_STILL_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_GIF_BYTES = 10 * 1024 * 1024; // 10 MB

export function maxBytesFor(type: string): number {
  return type === "image/gif" ? MAX_GIF_BYTES : MAX_STILL_BYTES;
}

/** Value for an <input type="file"> accept attribute. */
export const COVER_ACCEPT = COVER_MIME_TYPES.join(",");

export type CoverRejection = "type" | "size";

/**
 * Magic-byte signatures. The browser-supplied `file.type` is not trustworthy --
 * it comes from the client and is trivially spoofed -- and this bucket is
 * PUBLIC and served over HTTP, so a file that claims to be a PNG but is really
 * HTML or a script-bearing SVG would be a stored-XSS vector on our own origin.
 * Sniffing the leading bytes is what actually establishes the format.
 */
const SIGNATURES: { type: CoverMimeType; check: (b: Uint8Array) => boolean }[] = [
  // FF D8 FF
  { type: "image/jpeg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  // 89 P N G \r \n 1A \n
  {
    type: "image/png",
    check: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  // "GIF87a" / "GIF89a"
  {
    type: "image/gif",
    check: (b) =>
      b[0] === 0x47 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) &&
      b[5] === 0x61,
  },
  // "RIFF" .... "WEBP"  (4-byte size field sits between the two tags)
  {
    type: "image/webp",
    check: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

/** The real format of `bytes`, or null if it is not an accepted cover format. */
export function sniffCoverType(bytes: Uint8Array): CoverMimeType | null {
  return SIGNATURES.find((s) => s.check(bytes))?.type ?? null;
}

/**
 * Server-side gate. Checks the file's actual leading bytes rather than the
 * declared MIME type, then applies the size limit belonging to the format that
 * was actually found. Both halves matter: the sniff is what stops a script
 * disguised as a PNG, and keying the limit to the sniffed format is what stops
 * a 7 MB still being renamed .gif to claim the larger GIF allowance.
 */
export async function validateCoverFile(file: File): Promise<CoverRejection | null> {
  // Cheap bail-out before reading anything: nothing we accept can exceed the
  // largest limit, so an oversized file is rejected without buffering it.
  if (file.size > MAX_GIF_BYTES) return "size";

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const actualType = sniffCoverType(header);
  if (!actualType) return "type";

  if (file.size > maxBytesFor(actualType)) return "size";
  return null;
}

/**
 * Client-side pre-check, for instant feedback only. Uses the declared type
 * because reading bytes in the browser to reject a file the server will reject
 * anyway buys nothing -- validateCoverFile is the gate that counts.
 */
export function precheckCoverFile(file: File): CoverRejection | null {
  if (!COVER_MIME_TYPES.includes(file.type as CoverMimeType)) return "type";
  if (file.size > maxBytesFor(file.type)) return "size";
  return null;
}

export function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}`.replace(/\.0$/, "");
}

/**
 * Fills the {still}/{gif} placeholders in the cover hint and size-error
 * strings. Lives here so the limits are quoted from the same constants that
 * enforce them -- the numbers in the copy can't drift from the real rule.
 * Needed anywhere those strings are rendered: the field itself and both forms'
 * server-error banners.
 */
export function withCoverLimits(template: string): string {
  return template
    .replace("{still}", formatMb(MAX_STILL_BYTES))
    .replace("{gif}", formatMb(MAX_GIF_BYTES));
}
