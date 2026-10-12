-- TEST-ONLY Supabase shim. NOT part of the production schema.
--
-- The real migrations reference objects that Supabase provides but a plain
-- PostgreSQL install does not: auth.users, auth.uid(), and the storage schema.
-- This creates just enough of them that supabase/migrations/*.sql can be applied
-- UNMODIFIED against local Postgres -- which is the point: the migrations get
-- validated exactly as they will run in production, rather than a doctored copy.
--
-- Never apply this to a real Supabase project; Supabase already owns these.

create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;

-- Supabase's built-in roles. The storage policies in 0002 are granted
-- "to authenticated", so without these the migration cannot even be parsed.
-- Roles are cluster-wide rather than per-database, so this is written to be
-- safely re-runnable across repeated test runs.
do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I nologin noinherit', role_name);
    end if;
  end loop;
end
$$;

-- Minimal stand-in for Supabase's auth.users (only the columns we depend on).
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase derives auth.uid() from the request JWT. Matches Supabase's actual
-- function, not a simplification: modern PostgREST sets one request.jwt.claims
-- JSON GUC per request rather than a separate request.jwt.claim.<name> GUC per
-- claim, so a real deployment never populates the bare request.jwt.claim.sub
-- this checks first -- confirmed against a live PostgREST instance while
-- building supabase/localdev, where relying on it alone left auth.uid() always
-- NULL and every RLS check involving it silently failing closed. The coalesce
-- keeps this test suite's `select set_config('request.jwt.claim.sub', ...)`
-- impersonation working unchanged (see scripts/verify-db.ts) while also
-- matching production's real GUC.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  -- Both exist on real Supabase's storage.buckets with these types; the
  -- cover-media migration sets them, so the stand-in table needs them too.
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);

alter table storage.objects enable row level security;

-- Mirrors Supabase's helper: the folder segments of an object path, i.e. every
-- segment except the filename. 'uid/event/file.png' -> {uid, event}.
create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select (string_to_array(name, '/'))[
    1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)
  ];
$$;
