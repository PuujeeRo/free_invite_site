-- LOCAL-DEV-ONLY Supabase shim for running the real app (not just the schema
-- suite) against a plain local PostgreSQL via a natively-run PostgREST, with no
-- Docker and no GoTrue (Supabase Auth has no Windows binary and there is no Go
-- toolchain here to build one). NOT for a real Supabase project -- Supabase
-- already provides all of this, correctly, itself.
--
-- Differs from supabase/testing/shim.sql (the throwaway schema-test harness) in
-- one important way: that harness runs every check as a Postgres superuser, so
-- RLS bypass and role-switching are never actually exercised. Here PostgREST
-- authenticates as this database's login role and does a real `SET ROLE` per
-- request based on the caller's JWT -- `service_role` must actually bypass RLS
-- (mirroring Supabase's own behavior) and the login role must actually be a
-- member of anon/authenticated/service_role for that SET ROLE to succeed.

create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Matches Supabase's actual auth.uid() (not a simplification of it): modern
-- PostgREST sets one request.jwt.claims JSON GUC per request rather than a
-- separate request.jwt.claim.<name> GUC per claim, which is what the fallback
-- below is for. Verified against a live PostgREST request that the per-claim
-- GUC this originally checked only is never actually set -- auth.uid() was
-- silently always NULL, so every RLS check involving it failed closed.
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
  -- Both exist on real Supabase's storage.buckets with these types; migration
  -- 0006 sets them, so the stand-in table needs them or that migration fails
  -- here with "column file_size_limit does not exist".
  file_size_limit bigint,
  allowed_mime_types text[]
);

-- For a local database created before those two columns were added above:
-- `create table if not exists` leaves an existing table as it is.
alter table storage.buckets add column if not exists file_size_limit bigint;
alter table storage.buckets add column if not exists allowed_mime_types text[];

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select (string_to_array(name, '/'))[
    1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)
  ];
$$;

-- Supabase's built-in roles, with the real behavior PostgREST depends on.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  else
    alter role service_role bypassrls;
  end if;
end
$$;

-- The role PostgREST's db-uri connects as must be able to `SET ROLE` to each of
-- these for its per-request role-switching to work at all. This is the actual
-- Postgres login role in pgAdmin/psql, i.e. PGUSER in .env.test.local -- change
-- it here (and in .localdev/postgrest.conf's db-uri) if that differs.
grant anon, authenticated, service_role to test_local_invite;

-- On a real Supabase project this happens automatically at the platform level
-- and never appears in any migration file -- Postgres denies a query outright
-- (401, before RLS is even consulted) unless the role has a table-level GRANT,
-- so without this every request 401s regardless of what the RLS policies say.
-- RLS is still what actually does row-level filtering; this only grants access
-- to attempt the query at all, matching Supabase's own default setup.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
