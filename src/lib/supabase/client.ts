"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { getSupabaseAnonKey, getSupabaseUrl, supabaseDbOptions } from "./env";

// Browser client, used only for organizer auth (sign in/out) and any client-side
// reads that should honor the signed-in user's RLS policies.
export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), { db: supabaseDbOptions() });
}
