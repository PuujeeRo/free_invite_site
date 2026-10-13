import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { getSupabaseAnonKey, getSupabaseUrl, supabaseDbOptions } from "./env";
import { isLocalDevMode, createLocalDevServerClient } from "./local-dev";

// Server client bound to the current request's session cookies. Respects RLS as
// the signed-in organizer -- use this (not the admin client) for every dashboard
// read/write so a bug can never leak another organizer's events.
export async function createClient() {
  // Local-dev-only branch (see local-dev.ts): no real Supabase project, no
  // GoTrue, session comes from a plain signed-JWT cookie instead of a real
  // Supabase session. Returns the same Database-typed SupabaseClient shape, so
  // every call site below this function is identical in both modes.
  if (isLocalDevMode()) {
    return createLocalDevServerClient();
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    db: supabaseDbOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render (not an action/route handler);
          // middleware refreshes the session cookie for us in that case instead.
        }
      },
    },
  });
}
