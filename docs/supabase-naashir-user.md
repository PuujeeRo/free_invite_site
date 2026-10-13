# Running Naashir in a shared Supabase project

The hosted Supabase project already belongs to another app. Naashir lives beside it in its own schema, with its own PostgreSQL user, so the two apps' tables stay apart.

| | |
|---|---|
| Schema | `naashir` |
| User (role) | `naashir_admin` |
| Created | 2026-10-13, in the Supabase SQL Editor, as `postgres` |
| Password | Chosen at creation. Not written here; keep it in a password manager. |

This file holds no secrets. Do not add a password, a key or a full connection string to it.

## Status

- Done: the `naashir_admin` user and the empty `naashir` schema exist.
- Done: the app can be pointed at a schema (`NEXT_PUBLIC_SUPABASE_DB_SCHEMA`), and the install files are generated in `supabase/hosted/naashir/`.
- Not done: the install has not been run on the hosted project. The steps are under "Installing".
- Not tested: the app against the hosted project. The install files were tested on a local database set up like the hosted one (`scripts/verify-hosted-schema.ts`), which covers the database but not Supabase's Data API or sign-in.

## How it fits together

`supabase/migrations/` is still the only place migrations are written. They install into `public`, which is right for local development, for the test database, and for a Supabase project of Naashir's own.

`scripts/hosted-schema.ts` rewrites those same migrations for the `naashir` schema and puts them between a setup file and a finish file. The result is in `supabase/hosted/naashir/`, 18 files. They are generated: never edit them. After adding a migration, run:

```bash
npx tsx scripts/hosted-schema.ts build
```

What the rewrite changes:

- every `public.<name>` becomes `naashir.<name>`, and functions that fix their search path use `naashir`;
- the sign-up trigger on `auth.users` is named `naashir_on_auth_user_created`, because the usual name is very likely taken by the other app;
- the files run with `public` left out of the search path, so a name missing from `naashir` fails instead of quietly using the other app's table.

What the setup and finish files add:

- the grants Supabase gives `public` automatically and no other schema: its API roles may reach `naashir` and the tables created in it. Row-level security, on for every table, still decides which rows they see;
- a sign-up trigger that cannot fail a sign-up. It also runs for the other app's new users, so an error in it would stop people registering there. It reports a warning instead;
- a Naashir profile for everyone already registered in the project;
- access to the tables for `naashir_admin`.

## Installing

Do this once, on the hosted project.

1. **Run the 18 files, in number order, as `postgres`.** Either paste each file of `supabase/hosted/naashir/` into the SQL Editor, one at a time, or run them all with one command:

   ```bash
   npx tsx scripts/hosted-schema.ts apply "postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres"
   ```

   It stops at the first error and says which file. Each file is applied whole or not at all, so after fixing the cause continue from that file with `--from=0007` (its number). `0000_setup.sql` refuses to run if the schema already has tables.

2. **Expose the schema.** Supabase dashboard → Project Settings → API → Exposed schemas: add `naashir`. Until then the Data API rejects every request for it.

3. **Allow the redirect.** Authentication → URL Configuration → Redirect URLs: add `<site address>/auth/callback` for each address the site runs at (`http://localhost:3000/auth/callback` for this machine, and the Railway address).

4. **Check it.**

   ```bash
   npx tsx scripts/migration-status.ts "<same connection string>" --schema=naashir
   ```

   Every line should say `applied`.

5. **Point the app at it.** In `.env.local` (block B) and on the host:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role / secret key>
   NEXT_PUBLIC_SUPABASE_DB_SCHEMA=naashir
   ```

   `LOCAL_DEV_MODE` and the other `LOCAL_DEV_*` values must be off. `NEXT_PUBLIC_` values are read at build time: redeploy after changing them on the host.

6. **Try it.** Sign in at `/login`, create an invitation with a cover image, open its link in a private window, RSVP, and look at the response on the dashboard.

## What stays shared with the other app

A schema separates tables. These belong to the whole project and are not separated:

- **Accounts.** Sign-in is one list for both apps. Someone registered in the other app can sign in to Naashir with the same email, and the reverse. Everyone registered in either gets a Naashir profile row (id and email).
- **Sign-in email.** The magic-link email uses the project's template, sender and site address, which are the other app's. Its hourly sending limit is shared too.
- **"Delete my account".** In a shared project Naashir deletes the person's invitations, images and name, and disconnects their Gmail, but leaves the sign-in itself: removing it would delete their account in the other app as well. If the other app deletes an account, Naashir's rows for that person go with it, but their uploaded images stay in storage: once the rows are gone nothing knows the files are there, so nothing removes them.
- **Storage.** Naashir uses its own bucket, `event-media`. Bucket names and the storage quota are project-wide.
- **Limits.** Database size, storage and API usage are counted once for the project.

## The `naashir_admin` user

It is for people, not for the app: inspecting and maintaining Naashir's tables in pgAdmin or psql. The app never logs in as it; the app uses the Supabase URL and keys.

SQL that created it:

```sql
create role naashir_admin with login password '<password>';

-- Needed on Supabase: `postgres` is not a superuser there, and PostgreSQL only
-- lets you hand ownership to a role you are a member of.
grant naashir_admin to postgres;

create schema if not exists naashir authorization naashir_admin;
grant usage on schema naashir to anon, authenticated, service_role;
```

| | |
|---|---|
| Read and change Naashir's tables | Yes, once the install's finish file has run |
| Read the other app's tables in `public` | Should not be able to. Check once; see below. |
| Run the install | No. Two migrations change Supabase's own `auth` and `storage` schemas, which only `postgres` may do. |
| Bypass row-level security | No |

### Connecting

Use the **Session pooler** values from the "Connect" button in the Supabase dashboard. The direct connection is IPv6-only and does not resolve from this network. The transaction pooler is for short serverless requests and does not suit pgAdmin or psql.

| Field | Value |
|---|---|
| Host | the Session pooler host, like `aws-0-<region>.pooler.supabase.com` |
| Port | `5432` |
| Database | `postgres` |
| Username | `naashir_admin.<project-ref>` |
| Password | the password chosen at creation |
| SSL mode | `require` |

Through the pooler the username is the role name, a dot, then the project reference. Plain `naashir_admin` is rejected. The project reference is the first part of the project URL: `https://<project-ref>.supabase.co`.

### Checks to run once

Connected as `naashir_admin`. These have not been verified on the hosted project.

```sql
-- 1. Should print naashir_admin.
select current_user;

-- 2. Should fail with "permission denied". If it returns a row, the role can
--    read the other app's data and its grants need tightening.
select * from public.products limit 1;

-- 3. After the install: should return a count, not an error.
select count(*) from naashir.profiles;
```

### Changing the password

As `postgres`, in the SQL Editor:

```sql
alter role naashir_admin with password '<new-password>';
```

## Removing Naashir from the project

This deletes every Naashir table and all its data, and cannot be undone. The other app is not touched.

```sql
drop trigger if exists naashir_on_auth_user_created on auth.users;
drop schema naashir cascade;
drop role naashir_admin;
```

Then remove `naashir` from the exposed schemas, and delete the `event-media` bucket from the Storage page if its images should go too.
