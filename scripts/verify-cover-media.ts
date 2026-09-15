/**
 * Asserts the invitation cover upload rules actually hold.
 *
 *   npx tsx scripts/verify-cover-media.ts
 *
 * No database, network, or env setup -- this is pure logic over in-memory
 * files. Worth having as a script rather than a one-off check because the
 * interesting cases are adversarial: the storage bucket is public-read, so a
 * file that lies about its type is a stored-XSS vector on the storage origin,
 * and "we validate uploads" is the kind of claim that quietly stops being true.
 */
import {
  MAX_GIF_BYTES,
  MAX_STILL_BYTES,
  precheckCoverFile,
  sniffCoverType,
  validateCoverFile,
  withCoverLimits,
} from "@/lib/cover-media";

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failures.push(`${name}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** Builds a File whose first bytes are `header` and whose total size is `size`. */
function fileOf(header: number[], size: number, name: string, type: string): File {
  const bytes = new Uint8Array(Math.max(size, header.length));
  bytes.set(header, 0);
  return new File([bytes], name, { type });
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
// "RIFF" + 4 size bytes + "WEBP"
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const HTML = [...Buffer.from("<!DOCTYPE html><script>")];
const SVG = [...Buffer.from("<svg xmlns=\"http")];

const KB = 1024;

async function main() {
  // ---- sniffing identifies each accepted format ----
  check("sniff jpeg", sniffCoverType(new Uint8Array(JPEG)), "image/jpeg");
  check("sniff png", sniffCoverType(new Uint8Array(PNG)), "image/png");
  check("sniff gif89a", sniffCoverType(new Uint8Array(GIF89)), "image/gif");
  check("sniff gif87a", sniffCoverType(new Uint8Array(GIF87)), "image/gif");
  check("sniff webp", sniffCoverType(new Uint8Array(WEBP)), "image/webp");
  check("sniff html -> null", sniffCoverType(new Uint8Array(HTML)), null);
  check("sniff svg -> null", sniffCoverType(new Uint8Array(SVG)), null);
  check("sniff empty -> null", sniffCoverType(new Uint8Array(0)), null);

  // A RIFF container that is NOT WebP (e.g. a .wav) must not pass as one.
  const riffWave = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45];
  check("sniff RIFF/WAVE -> null", sniffCoverType(new Uint8Array(riffWave)), null);

  // ---- happy paths ----
  check("jpeg accepted", await validateCoverFile(fileOf(JPEG, 400 * KB, "a.jpg", "image/jpeg")), null);
  check("png accepted", await validateCoverFile(fileOf(PNG, 400 * KB, "a.png", "image/png")), null);
  check("webp accepted", await validateCoverFile(fileOf(WEBP, 400 * KB, "a.webp", "image/webp")), null);
  check("gif accepted", await validateCoverFile(fileOf(GIF89, 400 * KB, "a.gif", "image/gif")), null);

  // ---- the reason this file exists: lying about the type ----
  check(
    "html claiming image/png is rejected",
    await validateCoverFile(fileOf(HTML, 2 * KB, "totally.png", "image/png")),
    "type"
  );
  check(
    "svg claiming image/png is rejected",
    await validateCoverFile(fileOf(SVG, 2 * KB, "logo.png", "image/png")),
    "type"
  );
  check(
    "empty-but-declared-jpeg is rejected",
    await validateCoverFile(new File([new Uint8Array(0)], "a.jpg", { type: "image/jpeg" })),
    "type"
  );

  // ---- size limits follow the SNIFFED format, not the name or declared type ----
  check(
    "gif above still limit but below gif limit is accepted",
    await validateCoverFile(fileOf(GIF89, MAX_STILL_BYTES + KB, "big.gif", "image/gif")),
    null
  );
  check(
    "gif over gif limit is rejected",
    await validateCoverFile(fileOf(GIF89, MAX_GIF_BYTES + KB, "huge.gif", "image/gif")),
    "size"
  );
  check(
    "png over still limit is rejected",
    await validateCoverFile(fileOf(PNG, MAX_STILL_BYTES + KB, "big.png", "image/png")),
    "size"
  );
  check(
    "png renamed .gif cannot borrow the gif allowance",
    await validateCoverFile(fileOf(PNG, MAX_STILL_BYTES + KB, "sneaky.gif", "image/gif")),
    "size"
  );
  check(
    "gif renamed .png keeps the gif allowance (sniffed, not named)",
    await validateCoverFile(fileOf(GIF89, MAX_STILL_BYTES + KB, "real.png", "image/png")),
    null
  );

  // ---- boundaries are inclusive ----
  check(
    "still exactly at the limit is accepted",
    await validateCoverFile(fileOf(JPEG, MAX_STILL_BYTES, "edge.jpg", "image/jpeg")),
    null
  );
  check(
    "gif exactly at the limit is accepted",
    await validateCoverFile(fileOf(GIF89, MAX_GIF_BYTES, "edge.gif", "image/gif")),
    null
  );

  // ---- client pre-check mirrors the server's verdict on ordinary input ----
  check("precheck accepts gif", precheckCoverFile(fileOf(GIF89, 400 * KB, "a.gif", "image/gif")), null);
  check("precheck rejects pdf", precheckCoverFile(fileOf(PNG, 400 * KB, "a.pdf", "application/pdf")), "type");
  check(
    "precheck rejects oversized still",
    precheckCoverFile(fileOf(JPEG, MAX_STILL_BYTES + KB, "a.jpg", "image/jpeg")),
    "size"
  );

  // ---- copy quotes the same numbers the code enforces ----
  const hint = withCoverLimits("still={still} gif={gif}");
  check("limits interpolated into copy", hint, `still=${MAX_STILL_BYTES / 1024 / 1024} gif=${MAX_GIF_BYTES / 1024 / 1024}`);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  FAIL  ${f}`));
    process.exit(1);
  }
}

main();
