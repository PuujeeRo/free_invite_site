import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GMAIL_STATE_COOKIE, gmailConfigured, googleConsentUrl } from "@/lib/email/gmail";
import { safeNextPath } from "@/lib/safe-next";

// Starts "connect my Gmail": sends the signed-in organizer to Google's consent
// screen. The random state is kept in a cookie and must come back unchanged in
// the callback, so a link crafted by someone else cannot attach their Google
// account to this organizer's session.
export async function GET(request: NextRequest) {
  const back = safeNextPath(request.nextUrl.searchParams.get("back"));
  const origin = request.nextUrl.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!gmailConfigured()) return NextResponse.redirect(`${origin}${back}?gmail=off`);

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(googleConsentUrl(state));
  response.cookies.set(GMAIL_STATE_COOKIE, JSON.stringify({ state, back }), {
    httpOnly: true,
    sameSite: "lax", // must survive the top-level redirect back from Google
    secure: origin.startsWith("https://"),
    path: "/api/google",
    maxAge: 10 * 60,
  });
  return response;
}

export const dynamic = "force-dynamic";
