import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteEventsWithMedia } from "@/lib/event-cleanup";
import { EXPIRED_GRACE_DAYS } from "@/lib/event-types";

// Scheduled cleanup: removes free invitations whose link stopped working more
// than EXPIRED_GRACE_DAYS ago, with their uploaded covers and every guest,
// RSVP and view row. Until this existed the expiry only disabled the link;
// nothing was ever freed.
//
// Meant to be called once a day by a scheduler (vercel.json does it on Vercel;
// any cron that can send the header works elsewhere):
//
//   GET /api/cron/cleanup
//   Authorization: Bearer <CRON_SECRET>
//
// Refuses to run at all without CRON_SECRET, so a deploy that forgot to set it
// has a cleanup that does nothing rather than one anybody can trigger.
const BATCH = 200;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - EXPIRED_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Paid events never expire, so they are never candidates. Oldest first, a
  // bounded batch per run: a backlog is worked off over several days instead
  // of in one request that times out halfway.
  const { data: expired, error } = await admin
    .from("events")
    .select("id, organizer_id")
    .eq("is_paid", false)
    .lt("expires_at", cutoff)
    .order("expires_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  try {
    const result = await deleteEventsWithMedia(admin, expired ?? []);

    // Tip invoices nobody paid: QPay invoices are short-lived, so a pending
    // row a day old can no longer be paid and is only clutter.
    const staleTips = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await admin.from("tips").delete().neq("status", "paid").lt("created_at", staleTips);

    return NextResponse.json({ ok: true, candidates: expired?.length ?? 0, ...result });
  } catch {
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
