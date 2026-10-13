/**
 * Reports which migrations have been applied to the local dev database.
 *
 *   npx tsx scripts/migration-status.ts
 *
 * Read-only. Migrations here are applied by hand and nothing records which
 * have run, so this asks the database whether the thing each one creates is
 * there. Connects with LOCAL_DEV_PG_URL from .env.local (the same database the
 * app uses in local dev mode) -- or pass a connection string as the argument
 * to check a different one.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const ROOT = process.cwd();

function connectionString(): string {
  if (process.argv[2]) return process.argv[2];
  const envFile = join(ROOT, ".env.local");
  const line = existsSync(envFile)
    ? readFileSync(envFile, "utf8")
        .split(/\r?\n/)
        .find((l) => /^\s*LOCAL_DEV_PG_URL\s*=/.test(l))
    : undefined;
  if (!line) throw new Error("LOCAL_DEV_PG_URL is not set in .env.local (or pass a connection string)");
  return line
    .replace(/^\s*LOCAL_DEV_PG_URL\s*=\s*/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

async function main() {
  const client = new Client({ connectionString: connectionString(), connectionTimeoutMillis: 8000 });
  await client.connect();

  const ok = async (sql: string) => (await client.query<{ ok: boolean }>(sql)).rows[0]?.ok === true;
  const table = (name: string, schema = "public") =>
    ok(`select exists (select 1 from information_schema.tables where table_schema='${schema}' and table_name='${name}') as ok`);
  const column = (tableName: string, name: string, schema = "public") =>
    ok(`select exists (select 1 from information_schema.columns where table_schema='${schema}' and table_name='${tableName}' and column_name='${name}') as ok`);
  const enumValue = (type: string, label: string) =>
    ok(`select exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='${type}' and e.enumlabel='${label}') as ok`);
  const trigger = (name: string) => ok(`select exists (select 1 from pg_trigger where tgname='${name}') as ok`);

  const who = await client.query<{ db: string; usr: string }>(`select current_database() as db, current_user as usr`);
  console.log(`database ${who.rows[0].db} as ${who.rows[0].usr}\n`);

  // The local shim's storage.buckets has only id/name/public, so the bucket
  // limits of 0006 have nowhere to go there; a real Supabase project has them.
  const bucketLimits = await column("buckets", "file_size_limit", "storage");
  const limitFn =
    (
      await client.query<{ prosrc: string }>(
        `select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and proname='enforce_rsvp_limit'`
      )
    ).rows[0]?.prosrc ?? "";

  // true = applied, false = missing, null = cannot apply to this database.
  const checks: Record<string, boolean | null> = {
    "0001_init.sql": await table("events"),
    "0002_storage.sql": (await table("buckets", "storage"))
      ? await ok(`select exists (select 1 from storage.buckets where id='event-media') as ok`)
      : null,
    "0003_payment_providers.sql": await enumValue("payment_provider", "stripe"),
    "0004_qpay_checkout.sql": await column("payments", "checkout"),
    "0005_payment_rls.sql": await trigger("guard_event_paid_columns"),
    "0006_cover_media_limits.sql": bucketLimits
      ? await ok(`select exists (select 1 from storage.buckets where id='event-media' and file_size_limit is not null) as ok`)
      : null,
    "0007_more_event_types.sql": await enumValue("event_type", "baby_shower"),
    // 0008, 0013 and 0014 each redefine one function; a later one covers the earlier.
    "0008_event_type_limits.sql": /reunion|5000/.test(limitFn),
    "0009_greetings.sql": await column("events", "kind"),
    "0010_cover_layout.sql": await column("events", "cover_layout"),
    "0011_gallery.sql": await column("events", "gallery_urls"),
    "0012_seasonal_event_types.sql": await enumValue("event_type", "tsagaan_sar"),
    "0013_seasonal_event_limits.sql": /tsagaan_sar|5000/.test(limitFn),
    "0014_free_model.sql": (await table("event_views")) && limitFn.includes("5000"),
    "0015_gmail_sender.sql": await table("gmail_connections"),
    "0016_profile_name.sql": await column("profiles", "display_name"),
  };

  const files = readdirSync(join(ROOT, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let missing = 0;
  for (const file of files) {
    const state = checks[file];
    if (state === false) missing++;
    const label =
      state === true ? "applied " : state === false ? "MISSING " : state === null ? "n/a     " : "unknown ";
    console.log(`${label} ${file}${state === undefined ? "  (add a check for it to this script)" : ""}`);
  }
  console.log(missing === 0 ? "\nNothing to apply." : `\n${missing} to apply, in number order.`);
  await client.end();
}

main().catch((err) => {
  console.error("FAILED:", (err as Error).message);
  process.exit(1);
});
