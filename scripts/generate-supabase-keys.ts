/**
 * Generates the three secrets a self-hosted Supabase stack needs.
 *
 *   npx tsx scripts/generate-supabase-keys.ts
 *
 * Writes JWT_SECRET, ANON_KEY and SERVICE_ROLE_KEY to .env.supabase-keys.local
 * (ignored by git, like every .env* file) and prints nothing secret. The two
 * keys are JWTs signed with the secret, which is the only thing that makes
 * them valid: all three must be used together, and regenerating one means
 * regenerating all of them.
 *
 * Refuses to overwrite an existing file, since replacing the secret of a
 * running stack signs everybody out and invalidates the keys the app holds.
 */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { SignJWT } from "jose";

const FILE = ".env.supabase-keys.local";
const YEARS_VALID = 5; // same lifetime Supabase's own generator gives

async function sign(role: "anon" | "service_role", secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Supabase uses the secret as a plain string, not as base64.
  return new SignJWT({ role, iss: "supabase" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + YEARS_VALID * 365 * 24 * 60 * 60)
    .sign(new TextEncoder().encode(secret));
}

async function main() {
  if (existsSync(FILE)) {
    console.error(`${FILE} already exists. Delete it first if you really want new keys.`);
    process.exit(1);
  }

  // Hex only, so it survives being pasted into any form or shell unquoted.
  const secret = randomBytes(32).toString("hex");
  const lines = [
    "# Self-hosted Supabase secrets. Keep private; never commit.",
    `JWT_SECRET=${secret}`,
    `ANON_KEY=${await sign("anon", secret)}`,
    `SERVICE_ROLE_KEY=${await sign("service_role", secret)}`,
    "",
  ];
  writeFileSync(FILE, lines.join("\n"), { flag: "wx" });
  console.log(`Wrote ${FILE} (JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY; valid ${YEARS_VALID} years).`);
}

main().catch((err) => {
  console.error("FAILED:", (err as Error).message);
  process.exit(1);
});
