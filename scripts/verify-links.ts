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
import { buildComposeLinks, buildMimeMessage, encodeHeader, isPlainEmail } from "@/lib/email/mime";
import { decryptToken, encryptToken } from "@/lib/email/gmail";
import { safeNextPath } from "@/lib/safe-next";

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

  // ---- email: an address goes into a message header and into links ----
  check("ordinary address accepted", isPlainEmail("bat.saraa+inv@example.mn"), true);
  check("line break in address rejected", isPlainEmail("a@b.mn\r\nBcc: spam@evil.example"), false);
  check("two addresses rejected", isPlainEmail("a@b.mn,c@d.mn"), false);
  check("display-name form rejected", isPlainEmail("Bat <a@b.mn>"), false);
  check("no message for a bad address", buildMimeMessage({ to: "a@b.mn\nBcc: x@y.z", subject: "s", text: "t", html: "h" }), null);

  const mime = buildMimeMessage({ to: "a@b.mn", subject: "Бат & Сараа — урилга", text: "Сайн уу", html: "<p>Сайн уу</p>", boundary: "B" })!;
  const [mimeHead] = mime.split("\r\n\r\n");
  check("headers are pure ASCII", /^[\x00-\x7f]*$/.test(mimeHead), true);
  check("exactly one To header", mimeHead.split("\r\n").filter((l) => /^to:/i.test(l)), ["To: a@b.mn"]);
  check("no From header (Gmail sets it)", /^from:/im.test(mimeHead), false);
  const decodedSubject = [...encodeHeader("Бат & Сараа — урилга").matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)]
    .map((m) => Buffer.from(m[1], "base64").toString("utf8"))
    .join("");
  check("subject survives encoding", decodedSubject, "Бат & Сараа — урилга");
  check(
    "each encoded word is within 75 characters",
    encodeHeader("Төгсөлтийн баярын урилга ".repeat(6)).split("\r\n ").every((w) => w.length <= 75),
    true
  );
  check("line break in subject cannot start a header", encodeHeader("Hi\r\nBcc: x@y.z").includes("\n"), false);
  check("text part decodes", Buffer.from(mime.split("\r\n\r\n")[2].split("\r\n--B")[0], "base64").toString("utf8"), "Сайн уу");

  const compose = buildComposeLinks({ to: "a@b.mn", subject: "Урилга & баяр", body: "Мөр 1\nhttps://naashir.mn/i/x?to=1&a=2" })!;
  const gmailUrl = new URL(compose.gmail);
  check("gmail compose host", gmailUrl.origin + gmailUrl.pathname, "https://mail.google.com/mail/");
  check("gmail compose keeps the body intact", gmailUrl.searchParams.get("body"), "Мөр 1\nhttps://naashir.mn/i/x?to=1&a=2");
  check("gmail compose subject", gmailUrl.searchParams.get("su"), "Урилга & баяр");
  check("mailto has no stray query from the body", compose.mailto.split("?").length, 2);
  check(
    "mailto body round-trips",
    decodeURIComponent(compose.mailto.split("&body=")[1]),
    "Мөр 1\r\nhttps://naashir.mn/i/x?to=1&a=2"
  );
  check("no compose links for a bad address", buildComposeLinks({ to: "a@b.mn?bcc=x@y.z", subject: "s", body: "b" }), null);

  // ---- the stored Gmail token ----
  const key = Buffer.alloc(32, 7);
  const sealed = encryptToken("1//refresh-token", key);
  check("token round-trips", decryptToken(sealed, key), "1//refresh-token");
  check("token is not stored in the clear", sealed.includes("refresh"), false);
  check("same token encrypts differently each time", encryptToken("1//refresh-token", key) === sealed, false);
  check("wrong key yields nothing", decryptToken(sealed, Buffer.alloc(32, 8)), null);
  check("tampered token yields nothing", decryptToken(sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A") + "A", key), null);
  check("garbage yields nothing", decryptToken("not-a-token", key), null);

  // ---- where sign-in may send someone ----
  check("plain path kept", safeNextPath("/create"), "/create");
  check("dashboard path kept", safeNextPath("/dashboard/0b1f4c1e-aaaa-4bbb-8ccc-123456789abc"), "/dashboard/0b1f4c1e-aaaa-4bbb-8ccc-123456789abc");
  check("userinfo trick refused", safeNextPath("@evil.example"), "/dashboard");
  check("protocol-relative refused", safeNextPath("//evil.example"), "/dashboard");
  check("absolute url refused", safeNextPath("https://evil.example"), "/dashboard");
  check("backslash refused", safeNextPath("/\\evil.example"), "/dashboard");
  check("missing falls back", safeNextPath(null), "/dashboard");

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  FAIL  ${f}`));
    process.exit(1);
  }
}

main();
