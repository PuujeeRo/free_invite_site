import type { NextRequest } from "next/server";
import sharp from "sharp";
import { RATIO_SIZE, isImageRatio, verifyImageSignature } from "@/lib/image-proxy";
import { isPublicHost } from "@/lib/public-host";

// sharp is a native module and DNS lookups need Node APIs.
export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024; // refuse to buffer more than this from a remote host
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;

function fail(status: number, reason: string) {
  // Cached briefly so a broken link is not re-fetched on every page view.
  return new Response(reason, { status, headers: { "cache-control": "public, max-age=300" } });
}

// Follows redirects by hand so that EVERY hop is checked, not just the first:
// a public URL that redirects to an internal address must be refused too.
async function fetchPublicImage(start: URL): Promise<Response | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "https:") return null;
    if (!(await isPublicHost(current.hostname))) return null;

    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "image/*", "user-agent": "Mozilla/5.0 (compatible; NaashirBot/1.0)" },
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!next) return null;
      current = new URL(next, current);
      continue;
    }
    return response;
  }
  return null;
}

// Reads the body with a hard cap, since Content-Length can be absent or a lie.
async function readCapped(response: Response): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES || !response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * GET /api/img?u=<https image url>&r=<4x3|3x4>&s=<signature>
 *
 * Fetches an external gallery image, crops it to the card's ratio and serves
 * it as WebP. Only signed URLs are served (see lib/image-proxy.ts).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawUrl = params.get("u") ?? "";
  const ratio = params.get("r");
  const signature = params.get("s") ?? "";

  if (!isImageRatio(ratio) || !verifyImageSignature(rawUrl, ratio, signature)) {
    return fail(403, "bad signature");
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return fail(400, "bad url");
  }

  try {
    const upstream = await fetchPublicImage(target);
    if (!upstream || !upstream.ok) return fail(502, "could not fetch image");

    const input = await readCapped(upstream);
    if (!input) return fail(413, "image too large");

    const { width, height } = RATIO_SIZE[ratio];
    // Whether the bytes are really an image is decided by sharp decoding them,
    // not by the remote Content-Type header. limitInputPixels stops a tiny
    // file that declares enormous dimensions from exhausting memory.
    const output = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate() // apply the camera's EXIF orientation before cropping
      .resize(width, height, { fit: "cover", position: "attention" })
      .webp({ quality: 80 })
      .toBuffer();

    return new Response(new Uint8Array(output), {
      headers: {
        "content-type": "image/webp",
        // The URL is signed over its inputs, so a given URL always yields the
        // same picture unless the remote file itself changes.
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return fail(502, "could not process image");
  }
}
