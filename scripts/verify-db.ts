/**
 * Applies the real migrations to a throwaway local Postgres database and asserts
 * the database actually behaves the way the app assumes.
 *
 *   npx tsx scripts/verify-db.ts
 *
 * Needs a local PostgreSQL and these env vars (see .env.test.local.example):
 *   PGHOST PGPORT PGUSER PGPASSWORD
 *
 * This validates the SCHEMA, not the app: supabase-js talks to Supabase's REST
 * API rather than raw Postgres, so running the Next.js app still needs a real
 * Supabase project. What this does cover is the part that is pure database and
 * was previously never executed at all -- the migrations themselves, the
 * guest-limit trigger, the RSVP uniqueness rule, and the RLS policies.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { EVENT_TYPES, MAX_LIVE_INVITATIONS, RSVP_SAFETY_CEILING } from "@/lib/event-types";

const TEST_DB = "naashir_test";
const ROOT = process.cwd();

// Load .env.test.local (git-ignored) so the script runs with no shell setup.
// Deliberately tiny and dependency-free: plain KEY=value, and a value already
// present in the real environment always wins.
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

async function main() {
  // ---- create a clean test database --------------------------------------
  const admin = new Client(connCfg("postgres"));
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const db = new Client(connCfg(TEST_DB));
  await db.connect();

  // ---- apply shim + every migration, unmodified ---------------------------
  section("migrations apply");
  const files = [
    join(ROOT, "supabase/testing/shim.sql"),
    ...readdirSync(join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => join(ROOT, "supabase/migrations", f)),
  ];
  for (const file of files) {
    const name = file.split(/[\\/]/).pop() as string;
    try {
      await db.query(readFileSync(file, "utf8"));
      assert(`applies ${name}`, true);
    } catch (err) {
      assert(`applies ${name}`, false, String((err as Error).message).split("\n")[0]);
      throw err; // nothing downstream is meaningful if the schema is broken
    }
  }

  // ---- helpers ------------------------------------------------------------
  async function newOrganizer(): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `insert into auth.users (email)
       values ('org+' || gen_random_uuid() || '@test.local') returning id`
    );
    return rows[0].id;
  }
  async function newEvent(organizerId: string, eventType: string, isPaid = false): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.events (organizer_id, event_type, name, event_date, slug, is_paid)
       values ($1, $2::event_type, 'Test', current_date + 30, 'slug-' || gen_random_uuid(), $3)
       returning id`,
      [organizerId, eventType, isPaid]
    );
    return rows[0].id;
  }
  async function rsvp(eventId: string, device: string, status = "yes") {
    return db.query(
      `insert into public.rsvps (event_id, device_guest_id, status)
       values ($1, $2, $3::rsvp_status)`,
      [eventId, device, status]
    );
  }
  const isLimitError = (e: unknown) => String((e as Error).message).includes("guest_limit_reached");

  // ---- auth.users -> profiles trigger -------------------------------------
  section("profiles trigger");
  const orgId = await newOrganizer();
  const prof = await db.query(`select id from public.profiles where id = $1`, [orgId]);
  assert("new auth user gets a profile row", prof.rowCount === 1);

  // ---- guests: no per-category limit any more -----------------------------
  // Every category used to stop at 10 or 100 guests. The service is free now,
  // so each must simply accept guests -- checked past the old ceiling of 100.
  section("no per-category guest limit");
  for (const type of EVENT_TYPES) {
    const eventId = await newEvent(orgId, type.id);
    let accepted = 0;
    try {
      const res = await db.query(
        `insert into public.rsvps (event_id, device_guest_id, status)
         select $1, 'device-' || g, 'yes'::rsvp_status from generate_series(1, 120) g`,
        [eventId]
      );
      accepted = res.rowCount ?? 0;
    } catch (e) {
      if (!isLimitError(e)) throw e;
    }
    assert(`${type.id}: accepts 120 guests`, accepted === 120, `accepted=${accepted}`);
  }

  // ---- the safety ceiling: app constant vs DB trigger ---------------------
  // Not a product limit, but the number in lib/event-types.ts must still be
  // the number the database enforces.
  section("rsvp safety ceiling (app constant vs DB trigger)");
  const fullEvent = await newEvent(orgId, "birthday");
  await db.query(
    `insert into public.rsvps (event_id, device_guest_id, status)
     select $1, 'd-' || g, 'yes'::rsvp_status from generate_series(0, $2::int - 1) g`,
    [fullEvent, RSVP_SAFETY_CEILING]
  );
  let newBlocked = false;
  try {
    await rsvp(fullEvent, "d-new");
  } catch (e) {
    newBlocked = isLimitError(e);
  }
  assert(`device ${RSVP_SAFETY_CEILING + 1} is blocked`, newBlocked);

  // ---- paid events have no ceiling ---------------------------------------
  section("paid event bypasses the ceiling");
  const paidFull = await db.query(
    `update public.events set is_paid = true where id = $1 returning id`,
    [await newEvent(orgId, "birthday")]
  );
  let paidOk = true;
  try {
    await db.query(
      `insert into public.rsvps (event_id, device_guest_id, status)
       select $1, 'p-' || g, 'yes'::rsvp_status from generate_series(0, $2::int) g`,
      [paidFull.rows[0].id, RSVP_SAFETY_CEILING]
    );
  } catch {
    paidOk = false;
  }
  assert("paid event accepts more than the ceiling", paidOk);

  // ---- the reason api/rsvp uses update-then-insert, not upsert ------------
  // At the ceiling an EXISTING device must still be able to change its answer.
  // An INSERT..ON CONFLICT would re-run the BEFORE INSERT trigger and be
  // rejected here, which is exactly the bug that route avoids.
  section("existing guest can change answer at the ceiling");
  const upd = await db.query(
    `update public.rsvps set status = 'no' where event_id = $1 and device_guest_id = 'd-0'`,
    [fullEvent]
  );
  assert("existing device can still switch yes -> no", upd.rowCount === 1);

  const cnt = await db.query<{ count: string }>(
    `select count(*)::text as count from public.rsvps where event_id = $1`,
    [fullEvent]
  );
  assert(
    "changing an answer does not consume a slot",
    cnt.rows[0].count === String(RSVP_SAFETY_CEILING),
    `count=${cnt.rows[0].count}`
  );

  // ---- uniqueness + updated_at -------------------------------------------
  section("rsvp constraints");
  // Uniqueness must be checked on an event that is NOT at its limit: the BEFORE
  // INSERT limit trigger fires before the unique constraint is evaluated, so on an
  // event at the ceiling a duplicate device is rejected as guest_limit_reached and the
  // constraint never gets a chance to speak.
  const spareEvent = await newEvent(orgId, "birthday");
  await rsvp(spareEvent, "dup-device");
  let dupBlocked = false;
  try {
    await rsvp(spareEvent, "dup-device");
  } catch (e) {
    dupBlocked = String((e as Error).message).includes("duplicate key");
  }
  assert("(event_id, device_guest_id) is unique", dupBlocked);

  // And the ordering above, asserted directly, since it is what makes the
  // update-then-insert flow in api/rsvp necessary rather than merely tidy.
  let limitWinsOnFullEvent = false;
  try {
    await rsvp(fullEvent, "d-0");
  } catch (e) {
    limitWinsOnFullEvent = isLimitError(e);
  }
  assert("on a full event the limit trigger fires before the unique constraint", limitWinsOnFullEvent);

  const touched = await db.query<{ changed: boolean }>(
    `select updated_at > created_at as changed from public.rsvps
      where event_id = $1 and device_guest_id = 'd-0'`,
    [fullEvent]
  );
  assert("updated_at trigger bumps on update", touched.rows[0].changed === true);

  // ---- named guest tokens -------------------------------------------------
  section("named guests");
  const g = await db.query<{ guest_token: string }>(
    `insert into public.named_guests (event_id, first_name) values ($1, 'Bat') returning guest_token`,
    [fullEvent]
  );
  assert(
    "guest_token auto-generated",
    /^[0-9a-f]{18}$/.test(g.rows[0].guest_token),
    g.rows[0].guest_token
  );

  // ---- RLS: an organizer must not see another organizer's event ----------
  // Superusers bypass RLS, so this runs as a plain role, the way the app's
  // authenticated requests do.
  section("row level security");
  const otherOrg = await newOrganizer();
  const otherEvent = await newEvent(otherOrg, "wedding");

  try {
    await db.query(`drop role if exists naashir_test_auth`);
    await db.query(`create role naashir_test_auth nologin`);
    await db.query(`grant usage on schema public to naashir_test_auth`);
    await db.query(
      `grant select, insert, update, delete on all tables in schema public to naashir_test_auth`
    );
    // PostgreSQL 16 no longer implies SET ROLE from CREATEROLE, so the grant has
    // to ask for it explicitly or the impersonation below is refused.
    await db.query(`grant naashir_test_auth to current_user with set true`);

    await db.query("begin");
    await db.query(`set local role naashir_test_auth`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [orgId]);
    const visible = await db.query<{ id: string }>(`select id from public.events where id = $1`, [
      otherEvent,
    ]);
    const own = await db.query<{ id: string }>(`select id from public.events where id = $1`, [
      fullEvent,
    ]);
    await db.query("rollback");

    assert("cannot read another organizer's event", visible.rowCount === 0);
    assert("can read own event", own.rowCount === 1);
  } catch (e) {
    // Report rather than abort: RLS needs privileges the test role may not have,
    // and that must not silently look like the security check having passed.
    await db.query("rollback").catch(() => {});
    assert("RLS policies enforced", false, `could not run: ${String((e as Error).message)}`);
  }

  // ---- free-model rules (migration 0014), as an end user ------------------
  // These guards exempt privileged roles on purpose, so they have to be tested
  // as `authenticated`, the role an organizer's request really runs under.
  section("live invitation limit and guarded columns");
  const limitOrg = await newOrganizer();
  try {
    await db.query(`grant usage on schema public to authenticated`);
    await db.query(`grant select, insert, update, delete on all tables in schema public to authenticated`);
    await db.query(`grant authenticated to current_user with set true`);

    await db.query("begin");
    await db.query(`set local role authenticated`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [limitOrg]);

    const insertOwn = (extra = "", values = "") =>
      db.query<{ id: string; is_paid: boolean; days: number }>(
        `insert into public.events (organizer_id, event_type, name, event_date, slug${extra})
         values ($1, 'birthday', 'Live', current_date + 30, 'slug-' || gen_random_uuid()${values})
         returning id, is_paid, extract(epoch from (expires_at - now())) / 86400 as days`,
        [limitOrg]
      );

    // An organizer must not be able to create an already-paid invitation, nor
    // one that outlives the longest lifetime the form offers.
    const sneaky = await insertOwn(", is_paid, expires_at", ", true, now() + interval '5 years'");
    assert("is_paid cannot be set on insert", sneaky.rows[0].is_paid === false);
    assert(
      "expires_at is capped at 30 days on insert",
      Number(sneaky.rows[0].days) <= 30.01,
      `days=${Number(sneaky.rows[0].days).toFixed(2)}`
    );

    const chosen = await insertOwn(", expires_at", ", now() + interval '14 days'");
    assert(
      "a 14-day lifetime is kept as chosen",
      Math.abs(Number(chosen.rows[0].days) - 14) < 0.01,
      `days=${Number(chosen.rows[0].days).toFixed(2)}`
    );

    for (let i = 2; i < MAX_LIVE_INVITATIONS; i++) await insertOwn();

    await db.query("savepoint at_limit");
    let liveBlocked = false;
    try {
      await insertOwn();
    } catch (e) {
      liveBlocked = String((e as Error).message).includes("live_invitation_limit");
    }
    await db.query("rollback to savepoint at_limit");
    assert(`invitation ${MAX_LIVE_INVITATIONS + 1} is blocked`, liveBlocked);

    await db.query("savepoint extend");
    let extendBlocked = false;
    try {
      await db.query(`update public.events set expires_at = now() + interval '1 year' where id = $1`, [
        chosen.rows[0].id,
      ]);
    } catch (e) {
      extendBlocked = String((e as Error).message).includes("expires_at");
    }
    await db.query("rollback to savepoint extend");
    assert("an organizer cannot extend expires_at afterwards", extendBlocked);

    // Deleting one frees a place: this is what the limit message tells people to do.
    await db.query(`delete from public.events where id = $1`, [sneaky.rows[0].id]);
    let freed = true;
    try {
      await insertOwn();
    } catch {
      freed = false;
    }
    assert("deleting an invitation frees a place", freed);

    await db.query("rollback");
  } catch (e) {
    await db.query("rollback").catch(() => {});
    assert("free-model guards enforced", false, `could not run: ${String((e as Error).message)}`);
  }

  // A privileged role (the payment webhook, the Supabase dashboard) is exempt:
  // that is how an event is deliberately taken out of the limit.
  let exempt = true;
  try {
    for (let i = 0; i < MAX_LIVE_INVITATIONS + 2; i++) await newEvent(limitOrg, "birthday");
  } catch {
    exempt = false;
  }
  assert("a privileged role is not bound by the live limit", exempt);

  // ---- views, per device --------------------------------------------------
  section("event views");
  const viewedEvent = await newEvent(orgId, "wedding");
  const record = (device: string, kind: string) =>
    db.query(`select public.record_event_activity($1, $2, $3)`, [viewedEvent, device, kind]);
  await record("device-aaaa-0001", "view");
  await record("device-aaaa-0001", "view");
  await record("device-aaaa-0002", "view");
  await record("device-aaaa-0002", "map");
  await record("device-aaaa-0003", "calendar"); // clicked without a counted view
  await record("device-aaaa-0004", "nonsense");
  await record("short", "view");
  const stats = await db.query<{ devices: string; opens: string; map_clicks: string; calendar_clicks: string }>(
    `select * from public.event_view_stats($1)`,
    [viewedEvent]
  );
  const st = stats.rows[0];
  assert(
    "counts devices once and opens every time",
    st.devices === "2" && st.opens === "3" && st.map_clicks === "1" && st.calendar_clicks === "1",
    JSON.stringify(st)
  );

  // ---- tips ---------------------------------------------------------------
  section("tips");
  let tinyBlocked = false;
  try {
    await db.query(`insert into public.tips (amount) values (10)`);
  } catch {
    tinyBlocked = true;
  }
  assert("a tip below the minimum is rejected", tinyBlocked);
  const tip = await db.query<{ status: string; is_public: boolean }>(
    `insert into public.tips (amount) values (5000) returning status, is_public`
  );
  assert("a tip starts pending and private", tip.rows[0].status === "pending" && tip.rows[0].is_public === false);

  await db.end();

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nFATAL:", (err as Error).message);
  process.exit(1);
});
