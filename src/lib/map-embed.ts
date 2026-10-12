import { parseHttpLink, type LinkResult } from "@/lib/safe-link";

// Turns what an organizer pastes into the "map link" field into (a) a link for
// the "View on map" button and (b) a pinned OpenStreetMap embed.
//
// The embed is OpenStreetMap's own export/embed page: no API key, no billing
// account, no usage quota to manage. Its one constraint shapes this file --
// it places a pin from coordinates only and has no address search -- so the
// job here is getting coordinates out of whatever was pasted.

export interface Coords {
  lat: number;
  lng: number;
}

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

function valid(lat: number, lng: number): Coords | null {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

// Most specific first. A Google place link carries TWO coordinate pairs: `@`
// is only the centre of the visible map, while `!3d..!4d..` is the pin itself,
// and they can be hundreds of metres apart. Reading `@` first would put the
// pin in the wrong spot.
const LAT_LNG_PATTERNS: RegExp[] = [
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`), // Google: the pin
  new RegExp(String.raw`[?&]mlat=${NUM}&mlon=${NUM}`), // OpenStreetMap marker
  new RegExp(String.raw`[?&](?:q|query|ll|destination|center)=(?:loc:)?${NUM},\s*${NUM}`),
  new RegExp(String.raw`/place/${NUM},\s*${NUM}`),
  new RegExp(String.raw`/search/${NUM},\s*\+?${NUM}`),
  new RegExp(String.raw`#map=\d+/${NUM}/${NUM}`), // OpenStreetMap view
  new RegExp(String.raw`@${NUM},${NUM}`), // Google: view centre (last resort)
];

export function extractCoords(link: string | null | undefined): Coords | null {
  if (!link) return null;
  let text = link;
  try {
    text = decodeURIComponent(link);
  } catch {
    // A stray % that is not an escape: match against the raw string instead.
  }
  for (const pattern of LAT_LNG_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const coords = valid(Number(match[1]), Number(match[2]));
    if (coords) return coords;
  }
  return null;
}

/** "47.918, 106.917" typed or pasted on its own, instead of a link. */
export function parseRawCoords(text: string): Coords | null {
  const match = new RegExp(String.raw`^\s*${NUM}\s*[,;\s]\s*${NUM}\s*$`).exec(text);
  return match ? valid(Number(match[1]), Number(match[2])) : null;
}

export function osmLink({ lat, lng }: Coords): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/** The iframe URL for a pinned map, or null when the link has no coordinates. */
export function buildMapEmbedUrl(mapLink: string | null | undefined): string | null {
  const coords = extractCoords(mapLink);
  if (!coords) return null;
  // The embed is framed by a bounding box, not a zoom level. These half-spans
  // show a few city blocks around the pin. Longitude degrees shrink toward the
  // poles, so the east-west span is widened by 1/cos(latitude) to keep the box
  // roughly the same shape on the ground at Mongolia's ~48 degrees north as at
  // the equator.
  const dLat = 0.003;
  const dLng = 0.005 / Math.max(Math.cos((coords.lat * Math.PI) / 180), 0.2);
  const bbox = [coords.lng - dLng, coords.lat - dLat, coords.lng + dLng, coords.lat + dLat]
    .map((n) => n.toFixed(6))
    .join(",");
  const params = new URLSearchParams({ bbox, layer: "mapnik", marker: `${coords.lat},${coords.lng}` });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

// ---- server side: normalising what was pasted ----

// What Google's Share button produces. These contain no coordinates at all;
// the real link is behind a redirect.
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);
const MAX_STORED_LENGTH = 2000;

function isGoogleHost(hostname: string): boolean {
  return (
    SHORT_HOSTS.has(hostname) ||
    hostname === "google.com" ||
    hostname.endsWith(".google.com") ||
    /^(www\.|maps\.)?google\.[a-z.]{2,6}$/.test(hostname)
  );
}

/**
 * Expands a Google short link to the full link it redirects to, so the pin's
 * coordinates can be read from it. Returns the input unchanged whenever that
 * is not possible -- a link that cannot be expanded is still a perfectly good
 * link, so this never fails a save.
 *
 * Only ever contacts Google: every hop must be https on a Google host, so an
 * organizer cannot use this to make the server request an address of their
 * choosing.
 */
async function expandShortLink(link: string): Promise<string> {
  let current: URL;
  try {
    current = new URL(link);
  } catch {
    return link;
  }
  if (!SHORT_HOSTS.has(current.hostname)) return link;

  try {
    for (let hop = 0; hop < 5; hop++) {
      if (current.protocol !== "https:" || !isGoogleHost(current.hostname)) return link;
      if (extractCoords(current.toString())) break;

      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; NaashirBot/1.0)" },
      });
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!next) return link;
      current = new URL(next, current);
    }
    const expanded = current.toString();
    return isGoogleHost(current.hostname) && extractCoords(expanded) && expanded.length <= MAX_STORED_LENGTH
      ? expanded
      : link;
  } catch {
    return link;
  }
}

/**
 * Server-side entry point for the map field: accepts bare coordinates or any
 * http(s) link, and returns the link to store. Bare coordinates become an
 * OpenStreetMap link (so "View on map" has somewhere to go); a Google short
 * link is expanded so its pin can be shown.
 */
export async function normalizeMapInput(raw: unknown): Promise<LinkResult> {
  const text = typeof raw === "string" ? raw.trim() : "";
  const coords = parseRawCoords(text);
  if (coords) return { ok: true, url: osmLink(coords) };

  const link = parseHttpLink(text);
  if (!link.ok || !link.url) return link;
  return { ok: true, url: await expandShortLink(link.url) };
}

/** Client-side counterpart for previews: no network, so short links stay as they are. */
export function previewMapLink(raw: string): string | null {
  const coords = parseRawCoords(raw);
  if (coords) return osmLink(coords);
  const link = parseHttpLink(raw);
  return link.ok ? link.url : null;
}
