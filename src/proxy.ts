import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { isLocalDevMode } from "@/lib/supabase/local-dev";

// Next.js 16 "Proxy" (formerly Middleware). Refreshes the Supabase auth session
// cookie on every request so server components always see an up-to-date session.
// Guest-facing routes (i/*, api/rsvp, etc.) don't touch Supabase auth at all, so
// this is a no-op for them beyond the cheap cookie passthrough.
export async function proxy(request: NextRequest) {
  // Local-dev-only (see lib/supabase/local-dev.ts): the session is a plain
  // signed-JWT cookie with no GoTrue session behind it, so there is nothing to
  // refresh here -- the cookie is either present and valid or it isn't.
  if (isLocalDevMode()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/create",
    "/api/google/:path*",
    "/login",
    "/auth/:path*",
  ],
};
