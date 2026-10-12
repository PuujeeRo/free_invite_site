/**
 * Asserts the rules around organizer-supplied links and the image proxy.
 *
 *   npx tsx --conditions=react-server scripts/verify-links.ts
 *
 * (--conditions=react-server because lib/image-proxy.ts and lib/public-host.ts
 * are marked server-only, which refuses to load under plain Node otherwise.)
 *
 * No database or network. Everything here guards a place where text typed by
 * an organizer becomes an href, an <img src>, or an address our own server
 * fetches -- the cases are the hostile ones, because those are the ones that
 * silently stop being covered.
 */
import { parseHttpLink } from "@/lib/safe-link";
import { buildMapEmbedUrl, extractCoords, parseRawCoords, previewMapLink } from "@/lib/map-embed";
import { MAX_GALLERY_IMAGES, galleryUrlsOrEmpty, parseGalleryUrls, readGallery } from "@/lib/gallery";
import { isPrivateAddress, isPublicHost } from "@/lib/public-host";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { proxiedImageUrl, verifyImageSignature } from "@/lib/image-proxy";

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else failures.push(`${name}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  // ---- links that become an href ----
  check("https link accepted", parseHttpLink("https://maps.app.goo.gl/abc"), { ok: true, url: "https://maps.app.goo.gl/abc" });
  check("empty means no link", parseHttpLink("   "), { ok: true, url: null });
  check("javascript: rejected", parseHttpLink("javascript:alert(1)"), { ok: false });
  check("data: rejected", parseHttpLink("data:text/html,<script>1</script>"), { ok: false });
  check("scheme-less rejected", parseHttpLink("maps.google.com/x"), { ok: false });
  check("over-long rejected", parseHttpLink(`https://a.mn/${"x".repeat(600)}`), { ok: false });

  // ---- coordinates out of pasted links ----
  check(
    "google place: the pin, not the view centre",
    extractCoords("https://www.google.com/maps/place/X/@47.9000,106.9000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d47.9184676!4d106.9177016"),
    { lat: 47.9184676, lng: 106.9177016 }
  );
  check("google ?q=lat,lng", extractCoords("https://maps.google.com/?q=47.9185,106.9177"), { lat: 47.9185, lng: 106.9177 });
  check("google url-encoded comma", extractCoords("https://www.google.com/maps/search/?api=1&query=47.9185%2C106.9177"), { lat: 47.9185, lng: 106.9177 });
  check("google view-only link falls back to @", extractCoords("https://www.google.com/maps/@47.92,106.91,15z"), { lat: 47.92, lng: 106.91 });
  check("osm marker link", extractCoords("https://www.openstreetmap.org/?mlat=47.9185&mlon=106.9177#map=17/47.9/106.9"), { lat: 47.9185, lng: 106.9177 });
  check("osm view link", extractCoords("https://www.openstreetmap.org/#map=16/47.9185/106.9177"), { lat: 47.9185, lng: 106.9177 });
  check("short link has none", extractCoords("https://maps.app.goo.gl/AbCdEf123"), null);
  check("out-of-range rejected", extractCoords("https://maps.google.com/?q=147.9,106.9"), null);
  check("raw coords", parseRawCoords(" 47.9185, 106.9177 "), { lat: 47.9185, lng: 106.9177 });
  check("raw coords, negative", parseRawCoords("-33.86 151.21"), { lat: -33.86, lng: 151.21 });
  check("text is not coords", parseRawCoords("Blue Sky Tower"), null);
  check("raw coords preview as an OSM link", previewMapLink("47.9185, 106.9177"), "https://www.openstreetmap.org/?mlat=47.9185&mlon=106.9177#map=17/47.9185/106.9177");
  check("garbage previews as nothing", previewMapLink("javascript:alert(1)"), null);

  const embed = buildMapEmbedUrl("https://maps.google.com/?q=47.9185,106.9177");
  check("embed is an OpenStreetMap address", embed?.startsWith("https://www.openstreetmap.org/export/embed.html?"), true);
  check("embed carries the pin", new URL(embed!).searchParams.get("marker"), "47.9185,106.9177");
  const [w, s, e, n] = new URL(embed!).searchParams.get("bbox")!.split(",").map(Number);
  check("embed box contains the pin", w < 106.9177 && e > 106.9177 && s < 47.9185 && n > 47.9185, true);
  check("no coordinates, no embed", buildMapEmbedUrl("https://maps.app.goo.gl/AbCdEf123"), null);
  check("no link, no embed", buildMapEmbedUrl(null), null);

  // ---- gallery ----
  check("gallery: lines, blanks, duplicates", parseGalleryUrls("https://a.mn/1.jpg\n\n  https://a.mn/2.jpg \nhttps://a.mn/1.jpg"), {
    ok: true,
    urls: ["https://a.mn/1.jpg", "https://a.mn/2.jpg"],
  });
  check("gallery: empty is fine", parseGalleryUrls(""), { ok: true, urls: [] });
  check("gallery: http rejected (mixed content)", parseGalleryUrls("http://a.mn/1.jpg"), { ok: false });
  check("gallery: javascript rejected", parseGalleryUrls("https://a.mn/1.jpg\njavascript:alert(1)"), { ok: false });
  check(
    "gallery: over the cap rejected",
    parseGalleryUrls(Array.from({ length: MAX_GALLERY_IMAGES + 1 }, (_, i) => `https://a.mn/${i}.jpg`).join("\n")),
    { ok: false }
  );
  check("gallery preview keeps the valid lines", galleryUrlsOrEmpty("https://a.mn/1.jpg\nhttps://a.m\nnot a link\nhttps://a.mn/2.jpg").length, 3);
  check("stored gallery re-validated on read", readGallery(["https://a.mn/1.jpg", "javascript:alert(1)", 7]), ["https://a.mn/1.jpg"]);
  check("stored gallery: non-array is empty", readGallery(null), []);

  // ---- what the image proxy may connect to ----
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1"]) {
    check(`private: ${ip}`, isPrivateAddress(ip), true);
  }
  for (const ip of ["8.8.8.8", "172.15.0.1", "172.32.0.1", "100.63.0.1", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
    check(`public: ${ip}`, isPrivateAddress(ip), false);
  }
  check("literal loopback host refused", await isPublicHost("127.0.0.1"), false);
  check("bracketed ipv6 loopback refused", await isPublicHost("[::1]"), false);
  check("metadata address refused", await isPublicHost("169.254.169.254"), false);
  check("localhost refused", await isPublicHost("localhost"), false);

  // ---- proxy signatures ----
  process.env.IMAGE_PROXY_SECRET = "test-secret";
  const signed = new URL(proxiedImageUrl("https://a.mn/1.jpg", "4x3"), "https://x.mn");
  const sig = signed.searchParams.get("s")!;
  check("signed url points at our route", signed.pathname, "/api/img");
  check("own signature verifies", verifyImageSignature("https://a.mn/1.jpg", "4x3", sig), true);
  check("other url does not verify", verifyImageSignature("https://a.mn/2.jpg", "4x3", sig), false);
  check("other ratio does not verify", verifyImageSignature("https://a.mn/1.jpg", "3x4", sig), false);
  check("truncated signature does not verify", verifyImageSignature("https://a.mn/1.jpg", "4x3", sig.slice(0, 10)), false);
  delete process.env.IMAGE_PROXY_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_JWT_SECRET;
  check("no secret: link used directly", proxiedImageUrl("https://a.mn/1.jpg", "4x3"), "https://a.mn/1.jpg");
  check("no secret: nothing verifies", verifyImageSignature("https://a.mn/1.jpg", "4x3", sig), false);

  // ---- calendar ----
  const dates = (u: string | null) => (u ? new URL(u).searchParams.get("dates") : null);
  check("timed event, 3h block", dates(buildGoogleCalendarUrl({ title: "x", date: "2026-12-20", time: "18:00" })), "20261220T180000/20261220T210000");
  check("late event rolls into next year", dates(buildGoogleCalendarUrl({ title: "x", date: "2026-12-31", time: "22:30:00" })), "20261231T223000/20270101T013000");
  check("all-day ends next day, exclusive", dates(buildGoogleCalendarUrl({ title: "x", date: "2027-02-28" })), "20270228/20270301");
  check("no date, no link", buildGoogleCalendarUrl({ title: "x", date: "" }), null);
  check("calendar zone pinned", new URL(buildGoogleCalendarUrl({ title: "x", date: "2026-12-20", time: "18:00" })!).searchParams.get("ctz"), "Asia/Ulaanbaatar");

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  FAIL  ${f}`));
    process.exit(1);
  }
}

main();
