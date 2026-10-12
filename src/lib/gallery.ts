// Extra slider images for an invitation.
//
// Only the main cover is uploaded to our storage. Everything else in the
// slider is a link to an image hosted elsewhere, which keeps storage use at
// one file per invitation however many pictures an organizer wants to show.

export const MAX_GALLERY_IMAGES = 8;
const MAX_URL_LENGTH = 1000;

export type GalleryResult = { ok: true; urls: string[] } | { ok: false };

/**
 * Parses the "one link per line" gallery field.
 *
 * https only, unlike the map link: these are loaded as images inside our
 * https page, where a plain-http image is blocked or flagged as mixed content
 * by every current browser. Blank lines are ignored and duplicates dropped;
 * anything that is not an https address rejects the whole field, so a typo is
 * reported rather than silently losing a picture.
 */
export function parseGalleryUrls(raw: unknown): GalleryResult {
  const text = typeof raw === "string" ? raw : "";
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const urls: string[] = [];
  for (const line of lines) {
    if (line.length > MAX_URL_LENGTH) return { ok: false };
    let url: URL;
    try {
      url = new URL(line);
    } catch {
      return { ok: false };
    }
    if (url.protocol !== "https:") return { ok: false };
    const normalized = url.toString();
    if (!urls.includes(normalized)) urls.push(normalized);
  }
  if (urls.length > MAX_GALLERY_IMAGES) return { ok: false };
  return { ok: true, urls };
}

/** Lenient version for previews: whatever valid https links are there so far. */
export function galleryUrlsOrEmpty(raw: unknown): string[] {
  const text = typeof raw === "string" ? raw : "";
  const urls: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const result = parseGalleryUrls(line);
    if (result.ok && result.urls[0] && !urls.includes(result.urls[0])) urls.push(result.urls[0]);
    if (urls.length === MAX_GALLERY_IMAGES) break;
  }
  return urls;
}

/** What is stored: a string array, defensively re-validated when read back. */
export function readGallery(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return galleryUrlsOrEmpty(value.filter((v) => typeof v === "string").join("\n"));
}
