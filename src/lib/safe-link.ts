const MAX_LENGTH = 500;

export type LinkResult = { ok: true; url: string | null } | { ok: false };

/**
 * Validates an organizer-supplied web address (map link, video link).
 *
 * These values end up as an `href` or `src` on a public page, so they are
 * parsed rather than trusted: a `javascript:` or `data:` address there would
 * run in every guest's browser. Only http(s) is accepted. The host is not
 * restricted -- "share location" links come from several map apps, and an
 * ordinary web address is harmless.
 *
 * An empty value is valid and means "no link".
 */
export function parseHttpLink(raw: unknown): LinkResult {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: true, url: null };
  if (value.length > MAX_LENGTH) return { ok: false };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false };
  return { ok: true, url: url.toString() };
}

/** The link if it is valid, otherwise nothing. For rendering and previews. */
export function httpLinkOrNull(raw: unknown): string | null {
  const result = parseHttpLink(raw);
  return result.ok ? result.url : null;
}
