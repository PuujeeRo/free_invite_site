import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getSupabaseServiceRoleKey, getSupabaseUrl, supabaseDbOptions } from "./env";

// Service-role client. Bypasses Row Level Security entirely -- import this ONLY
// from server route handlers / server actions that serve unauthenticated guests
// (public invite page, RSVP submit, named-guest token lookup, payment webhook,
// email send) and that perform their own authorization checks (slug match, etc).
// Never import this from a Client Component or expose the key to the browser.
export function createAdminClient() {
  return createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    db: supabaseDbOptions(),
  });
}
