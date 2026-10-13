/**
 * Installs the hosted-schema files into a throwaway local database that
 * already holds another app, and asserts the two do not disturb each other.
 *
 *   npx tsx scripts/verify-hosted-schema.ts
 *
 * Same requirements as scripts/verify-db.ts (a local PostgreSQL and
 * .env.test.local). It checks what verify-db.ts cannot: that the migrations
 * still work once rewritten for a schema of their own (scripts/hosted-schema.ts)
 * next to a `public` schema that has its own `profiles` table and its own
 * sign-up trigger of the usual name.
 *
 * Like verify-db.ts this exercises the database, not the app or Supabase's
 * Data API: that the API serves the schema depends on a dashboard setting no
 * local test can see.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { MAX_LIVE_INVITATIONS } from "@/lib/event-types";
import { DEFAULT_SCHEMA, applyFiles, buildFiles } from "./hosted-schema";

const TEST_DB = "naashir_hosted_test";
const SCHEMA = DEFAULT_SCHEMA;
const ADMIN_ROLE = `${SCHEMA}_admin`;
const ROOT = process.cwd();

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  }
}
loadEnvFile(join(ROOT, ".env.test.local"));

let failures = 0;
function assert(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
}
function section(name: string) {
  console.log(`\n--- ${name} ---`);
}

function connCfg(database: string) {
  return {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
    database,
  };
}

// The other app: its own `profiles` (different columns), its own sign-up
// trigger under the name every Supabase tutorial uses, and people already
// registered.
const OTHER_APP = `
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'member'
);
create table public.products (id serial primary key, title text not null);
insert into public.products (title) values ('one'), ('two');

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name) values (new.id, 'new member');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into auth.users (email) values ('a@other.app'), ('b@other.app'), ('c@other.app');
`;

async function main() {
  const admin = new Client(connCfg("postgres"));
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  // Roles belong to the whole server, not to the test database, so only one
  // this run created is removed again at the end.
  const hadAdminRole = (await admin.query(`select 1 from pg_roles where rolname = $1`, [ADMIN_ROLE])).rowCount === 1;
  if (!hadAdminRole) await admin.query(`create role ${ADMIN_ROLE} nologin`);
  await admin.end();

  const db = new Client(connCfg(TEST_DB));
  await db.connect();
  const one = async <T>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0] as T;
  const names = async (sql: string) => (await db.query<{ name: string }>(sql)).rows.map((r) => r.name).sort();

  try {
    // ---- a project that already has another app in it ----------------------
    section("setting");
    // Supabase keeps pgcrypto in `extensions`, not in `public`, and the hosted
    // files rely on that: their search path leaves `public` out on purpose.
    await db.query(`create schema extensions; create extension pgcrypto schema extensions;`);
    await db.query(readFileSync(join(ROOT, "supabase/testing/shim.sql"), "utf8"));
    await db.query(OTHER_APP);
    await db.query(`grant ${ADMIN_ROLE} to current_user`);
    await db.query(`create schema ${SCHEMA} authorization ${ADMIN_ROLE}`);
    const publicBefore = await names(
      `select table_name || ':' || string_agg(column_name, ',' order by ordinal_position) as name
         from information_schema.columns where table_schema = 'public' group by table_name`
    );
    assert("other app is in place", publicBefore.length === 2, publicBefore.join(" | "));

    // ---- install -----------------------------------------------------------
    section("install");
    const files = buildFiles(SCHEMA);
    let installed = true;
    try {
      await applyFiles(db, files, () => {});
    } catch (err) {
      installed = false;
      console.log(String((err as Error).message));
    }
    assert(`all ${files.length} files apply`, installed);
    if (!installed) return;

    let secondRunRefused = false;
    try {
      await db.query(files[0].sql);
    } catch {
      secondRunRefused = true;
    }
    assert("setup refuses a schema that is already installed", secondRunRefused);

    // ---- where everything ended up ------------------------------------------
    section("placement");
    const tables = await names(`select table_name as name from information_schema.tables where table_schema = '${SCHEMA}'`);
    const expected = ["event_views", "events", "gmail_connections", "named_guests", "payments", "profiles", "rsvps", "tips"];
    assert(`${SCHEMA} has every table`, expected.every((t) => tables.includes(t)), tables.join(", "));

    const publicAfter = await names(
      `select table_name || ':' || string_agg(column_name, ',' order by ordinal_position) as name
         from information_schema.columns where table_schema = 'public' group by table_name`
    );
    assert("public tables and their columns are untouched", publicAfter.join("|") === publicBefore.join("|"));

    const publicEnums = await names(
      `select typname as name from pg_type t join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'`
    );
    assert("no type leaked into public", publicEnums.length === 0, publicEnums.join(", "));

    const publicFns = await names(
      `select proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`
    );
    assert("no function leaked into public", publicFns.join(",") === "handle_new_user", publicFns.join(", "));

    const strayRefs = await names(
      `select proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = '${SCHEMA}' and (prosrc ~ '\\mpublic\\.' or array_to_string(proconfig, ',') ~ 'search_path=public')`
    );
    assert("no function still points at public", strayRefs.length === 0, strayRefs.join(", "));

    const noRls = await names(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = '${SCHEMA}' and c.relkind = 'r' and not c.relrowsecurity`
    );
    assert("row-level security is on for every table", noRls.length === 0, noRls.join(", "));

    // ---- the shared sign-up table -------------------------------------------
    section("auth.users is shared");
    const triggers = await names(
      `select tgname as name from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal`
    );
    assert(
      "both apps keep their own sign-up trigger",
      triggers.join(",") === `${SCHEMA}_on_auth_user_created,on_auth_user_created`,
      triggers.join(", ")
    );

    const backfilled = await one<{ n: number }>(`select count(*)::int as n from ${SCHEMA}.profiles`);
    assert("people already registered got a profile", backfilled.n === 3, `${backfilled.n}`);

    const fresh = await one<{ id: string }>(`insert into auth.users (email) values ('new@person.mn') returning id`);
    const both = await one<{ ours: number; theirs: number }>(
      `select (select count(*)::int from ${SCHEMA}.profiles where id = $1) as ours,
              (select count(*)::int from public.profiles where id = $1) as theirs`,
      [fresh.id]
    );
    assert("a new sign-up gets a profile in both apps", both.ours === 1 && both.theirs === 1, JSON.stringify(both));

    // Break Naashir's side on purpose: the other app's sign-up must still work.
    await db.query(`alter table ${SCHEMA}.profiles add constraint tmp_break check (email <> 'break@me.mn')`);
    let signupSurvived = true;
    let brokenId = "";
    try {
      brokenId = (await one<{ id: string }>(`insert into auth.users (email) values ('break@me.mn') returning id`)).id;
    } catch {
      signupSurvived = false;
    }
    const afterBreak = signupSurvived
      ? await one<{ ours: number; theirs: number }>(
          `select (select count(*)::int from ${SCHEMA}.profiles where id = $1) as ours,
                  (select count(*)::int from public.profiles where id = $1) as theirs`,
          [brokenId]
        )
      : { ours: -1, theirs: -1 };
    assert(
      "a failure on Naashir's side does not block the other app's sign-up",
      signupSurvived && afterBreak.theirs === 1 && afterBreak.ours === 0,
      JSON.stringify(afterBreak)
    );
    await db.query(`alter table ${SCHEMA}.profiles drop constraint tmp_break`);

    // ---- privileges ---------------------------------------------------------
    section("privileges");
    const priv = await one<{ anon_use: boolean; auth_events: boolean; service_events: boolean; admin_events: boolean; auth_record: boolean; service_record: boolean }>(
      `select has_schema_privilege('anon', '${SCHEMA}', 'usage') as anon_use,
              has_table_privilege('authenticated', '${SCHEMA}.events', 'insert') as auth_events,
              has_table_privilege('service_role', '${SCHEMA}.tips', 'insert') as service_events,
              has_table_privilege('${ADMIN_ROLE}', '${SCHEMA}.events', 'select') as admin_events,
              has_function_privilege('authenticated', '${SCHEMA}.record_event_activity(uuid, text, text)', 'execute') as auth_record,
              has_function_privilege('service_role', '${SCHEMA}.record_event_activity(uuid, text, text)', 'execute') as service_record`
    );
    assert("API roles can reach the schema and its tables", priv.anon_use && priv.auth_events && priv.service_events);
    assert(`${ADMIN_ROLE} can read the tables`, priv.admin_events);
    assert("view recording stays service-role only", !priv.auth_record && priv.service_record);
    const adminReach = await one<{ products: boolean; profiles: boolean }>(
      `select has_table_privilege('${ADMIN_ROLE}', 'public.products', 'select') as products,
              has_table_privilege('${ADMIN_ROLE}', 'public.profiles', 'select') as profiles`
    );
    assert(`${ADMIN_ROLE} cannot read the other app's tables`, !adminReach.products && !adminReach.profiles);

    // ---- behaviour, as an organizer -----------------------------------------
    // Under `authenticated`, the role a signed-in request really runs as, so
    // the grants above, RLS and the guards are all in play at once.
    section("as a signed-in organizer");
    await db.query(`grant authenticated, anon to current_user`);
    const other = await one<{ id: string }>(`insert into auth.users (email) values ('other@person.mn') returning id`);
    const otherEvent = await one<{ id: string }>(
      `insert into ${SCHEMA}.events (organizer_id, event_type, name, event_date, slug)
       values ($1, 'tsagaan_sar', 'Theirs', current_date + 10, 'theirs-' || gen_random_uuid()) returning id`,
      [other.id]
    );
    try {
      await db.query("begin");
      await db.query(`set local role authenticated`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [fresh.id]);

      let made = 0;
      let limitCode = "";
      for (let i = 0; i < MAX_LIVE_INVITATIONS + 1; i++) {
        await db.query("savepoint attempt");
        try {
          await db.query(
            `insert into ${SCHEMA}.events (organizer_id, event_type, name, event_date, slug)
             values ($1, 'new_year', 'Mine', current_date + 30, 'mine-' || gen_random_uuid())`,
            [fresh.id]
          );
          made++;
        } catch (err) {
          limitCode = (err as { code?: string }).code ?? "";
          await db.query("rollback to savepoint attempt");
        }
      }
      assert(
        `creates ${MAX_LIVE_INVITATIONS} invitations and is stopped at the next`,
        made === MAX_LIVE_INVITATIONS && limitCode === "P0003",
        `made ${made}, code ${limitCode}`
      );

      const seen = await one<{ mine: number; theirs: number }>(
        `select (select count(*)::int from ${SCHEMA}.events where organizer_id = $1) as mine,
                (select count(*)::int from ${SCHEMA}.events where id = $2) as theirs`,
        [fresh.id, otherEvent.id]
      );
      assert("sees own invitations and not another organizer's", seen.mine === MAX_LIVE_INVITATIONS && seen.theirs === 0);

      await db.query("savepoint forged_attempt");
      let foreignRejected = false;
      try {
        await db.query(
          `insert into ${SCHEMA}.events (organizer_id, event_type, name, event_date, slug)
           values ($1, 'birthday', 'Forged', current_date + 5, 'forged-' || gen_random_uuid())`,
          [other.id]
        );
      } catch {
        foreignRejected = true;
        await db.query("rollback to savepoint forged_attempt");
      }
      assert("cannot create an invitation as someone else", foreignRejected);

      const stats = await db.query(`select * from ${SCHEMA}.event_view_stats($1)`, [otherEvent.id]);
      assert("view stats function runs", stats.rowCount !== null);
    } catch (err) {
      assert("organizer checks ran", false, String((err as Error).message));
    } finally {
      await db.query("rollback").catch(() => {});
    }

    // ---- anonymous ----------------------------------------------------------
    section("as a visitor");
    try {
      await db.query("begin");
      await db.query(`set local role anon`);
      const visible = await one<{ n: number }>(`select count(*)::int as n from ${SCHEMA}.events`);
      assert("a visitor reads no invitations directly", visible.n === 0, `${visible.n}`);
      await db.query("savepoint tip");
      let tipRejected = false;
      try {
        await db.query(`insert into ${SCHEMA}.tips (amount, currency, provider, status) values (5000, 'MNT', 'qpay', 'paid')`);
      } catch {
        tipRejected = true;
        await db.query("rollback to savepoint tip");
      }
      assert("a visitor cannot write a tip directly", tipRejected);
    } catch (err) {
      assert("visitor checks ran", false, String((err as Error).message));
    } finally {
      await db.query("rollback").catch(() => {});
    }
  } finally {
    await db.end();
    const cleanup = new Client(connCfg("postgres"));
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${TEST_DB} with (force)`);
    if (!hadAdminRole) await cleanup.query(`drop role if exists ${ADMIN_ROLE}`);
    await cleanup.end();
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FAILED:", (err as Error).message);
  process.exit(1);
});
