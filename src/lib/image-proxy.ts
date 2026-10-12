import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// External gallery images are not shown straight from their source. The guest
// page points at our own /api/img route, which fetches the image, crops it to
// the card's aspect ratio with sharp and re-encodes it. That gives every slide
// the same shape and a sane file size, whatever the organizer linked to (a
// 12 MB phone photo, a portrait picture in a landscape slot, ...).

export type ImageRatio = "4x3" | "3x4";

// Output sizes. 4x3 is the cover slot above/below the text; 3x4 is the tall
// full-background layout. Both are roughly 2x the largest size the card is
// ever drawn at, for sharp rendering on high-density phone screens.
export const RATIO_SIZE: Record<ImageRatio, { width: number; height: number }> = {
  "4x3": { width: 960, height: 720 },
  "3x4": { width: 900, height: 1200 },
};

export function isImageRatio(value: unknown): value is ImageRatio {
  return value === "4x3" || value === "3x4";
}

// A route that fetches any URL it is handed is an open proxy: anyone could use
// our server and bandwidth to fetch and re-serve arbitrary images. So the
// route only honours URLs that carry a signature made here, i.e. URLs that an
// organizer actually saved on an invitation.
function secret(): string | null {
  return (
    process.env.IMAGE_PROXY_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_JWT_SECRET ||
    null
  );
}

function sign(url: string, ratio: ImageRatio, key: string): string {
  return createHmac("sha256", key).update(`${ratio}\n${url}`).digest("base64url").slice(0, 32);
}

/**
 * The address to put in an <img> for an external image. Falls back to the
 * original URL when no signing secret is configured: the slider then still
 * works, just without the crop/resize step (CSS object-fit still makes it
 * fill the slot).
 */
export function proxiedImageUrl(url: string, ratio: ImageRatio): string {
  const key = secret();
  if (!key) return url;
  const params = new URLSearchParams({ u: url, r: ratio, s: sign(url, ratio, key) });
  return `/api/img?${params.toString()}`;
}

export function verifyImageSignature(url: string, ratio: ImageRatio, signature: string): boolean {
  const key = secret();
  if (!key) return false;
  const expected = Buffer.from(sign(url, ratio, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
