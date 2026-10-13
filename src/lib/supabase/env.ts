function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in your Supabase project settings.`
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const SCHEMA_NAME = /^[a-z_][a-z0-9_]*$/;

/**
 * The Postgres schema Naashir's tables live in. "public" unless
 * NEXT_PUBLIC_SUPABASE_DB_SCHEMA says otherwise, which is how the app shares a
 * Supabase project with another app: its tables go in their own schema (see
 * docs/supabase-naashir-user.md) and every query is sent there.
 *
 * NEXT_PUBLIC_ because the browser client needs it too; a schema name is not a
 * secret. Only tables, views and functions follow it -- sign-in and file
 * storage belong to the project, not to a schema.
 */
export function getSupabaseDbSchema(): string {
  const schema = process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA?.trim() || "public";
  if (!SCHEMA_NAME.test(schema)) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_DB_SCHEMA "${schema}" is not a valid schema name`);
  }
  return schema;
}

/** True when the project is shared with another app (see getSupabaseDbSchema). */
export function isSharedSupabaseProject(): boolean {
  return getSupabaseDbSchema() !== "public";
}

/**
 * The `db` option for every Supabase client. The cast is the one place the
 * types are told a small lie: the generated Database type only knows the
 * schema by the name "public", and the tables are the same whichever schema
 * they were installed into.
 */
export function supabaseDbOptions(): { schema: "public" } {
  return { schema: getSupabaseDbSchema() as "public" };
}
