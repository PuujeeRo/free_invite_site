"use server";

import { redirect } from "next/navigation";
import type { Client as PgClient } from "pg";
import { isLocalDevMode, setLocalDevSession } from "@/lib/supabase/local-dev";
import { safeNextPath } from "@/lib/safe-next";

export interface DevLoginState {
  error?: string;
}

// Direct Postgres connection, not PostgREST: PostgREST only exposes the public
// schema (db-schemas = "public" in .localdev/postgrest.conf, matching real
// Supabase, which never exposes auth.* via its REST API either -- GoTrue talks
// to auth.users directly). Creating a dev organizer means inserting into
// auth.users, which is exactly the one thing that has to bypass PostgREST.
//
// `pg` is a devDependency, not a real dependency -- this app should never need
// a raw Postgres driver in production, where LOCAL_DEV_MODE is never set. The
// import is dynamic (not a static top-level import) specifically so a
// production install with --omit=dev doesn't fail `next build` over a module
// this code path can never actually reach there.
async function connect(): Promise<PgClient> {
  const connectionString = process.env.LOCAL_DEV_PG_URL;
  if (!connectionString) {
    throw new Error("Missing LOCAL_DEV_PG_URL (required when LOCAL_DEV_MODE=true) -- see .env.local");
  }
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

export async function devSignIn(existingUserId: string, next: string): Promise<void> {
  if (!isLocalDevMode()) redirect("/login");
  await setLocalDevSession(existingUserId);
  redirect(safeNextPath(next));
}

export async function devSignInOrCreate(_prevState: DevLoginState, formData: FormData): Promise<DevLoginState> {
  if (!isLocalDevMode()) redirect("/login");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter an email." };

  const client = await connect();
  try {
    const existing = await client.query<{ id: string }>("select id from auth.users where email = $1", [
      email,
    ]);
    const userId =
      existing.rows[0]?.id ??
      (
        await client.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [
          email,
        ])
      ).rows[0].id;

    await setLocalDevSession(userId);
  } finally {
    await client.end();
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
