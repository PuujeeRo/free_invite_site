import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GMAIL_STATE_COOKIE, completeGmailConnection, gmailConfigured } from "@/lib/email/gmail";
import { safeNextPath } from "@/lib/safe-next";

// Where Google sends the organizer back after the consent screen. Every way
// this can go wrong ends in a redirect to the page they started from with a
// ?gmail= result for it to show; nothing is ever rendered here.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  let stored: { state?: string; back?: string } = {};
  try {
    stored = JSON.parse(request.cookies.get(GMAIL_STATE_COOKIE)?.value ?? "{}");
  } catch {
    // Treated as a missing cookie below.
  }
  const back = safeNextPath(stored.back);

  const finish = (result: string) => {
    const response = NextResponse.redirect(`${origin}${back}?gmail=${result}`);
    response.cookies.delete({ name: GMAIL_STATE_COOKIE, path: "/api/google" });
    return response;
  };

  const given = Buffer.from(params.get("state") ?? "");
  const expected = Buffer.from(stored.state ?? "");
  if (expected.length === 0 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return finish("failed");
  }

  const code = params.get("code");
  // Pressing "Cancel" on the consent screen arrives as ?error=access_denied.
  if (!code || !gmailConfigured()) return finish(params.get("error") ? "cancelled" : "failed");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const outcome = await completeGmailConnection(user.id, code);
  return finish(outcome === "connected" ? "connected" : outcome === "no_send_permission" ? "denied" : "failed");
}

export const dynamic = "force-dynamic";
