import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Records that a device opened an invitation, or used its map or calendar
// button. Sent by components/track/ViewTracker.tsx from the guest page.
//
// Deliberately answers 204 to everything, valid or not: the guest's browser
// has no use for the outcome, and a counter must never be the reason an
// invitation shows an error. The database function does the real checking
// (known kind, sane device id, a ceiling on devices per invitation).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["view", "map", "calendar"]);

export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });

  // sendBeacon posts text/plain, so the body is parsed by hand either way.
  const body = (await request
    .text()
    .then((text) => JSON.parse(text))
    .catch(() => null)) as { event_id?: unknown; device_id?: unknown; kind?: unknown } | null;

  const eventId = body?.event_id;
  const deviceId = body?.device_id;
  const kind = body?.kind;
  if (
    typeof eventId !== "string" ||
    !UUID.test(eventId) ||
    typeof deviceId !== "string" ||
    deviceId.length < 8 ||
    deviceId.length > 64 ||
    typeof kind !== "string" ||
    !KINDS.has(kind)
  ) {
    return done;
  }

  try {
    await createAdminClient().rpc("record_event_activity", {
      p_event_id: eventId,
      p_device_id: deviceId,
      p_kind: kind,
    });
  } catch {
    // Includes a database without migration 0014: counting is simply off.
  }
  return done;
}
