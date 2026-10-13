# Naashir

Create an animated event invitation in a few clicks, share the link on Messenger, and watch guest RSVPs come in on a live dashboard. See [docs/Naashir_Product_Plan_v1.md](docs/Naashir_Product_Plan_v1.md) for the full product plan (pricing, guest-limit rules, build order).

## Stack

- **Next.js** (App Router, TypeScript, Tailwind CSS v4)
- **Supabase** — Postgres, Auth (magic link), Storage
- **QPay** (tips) and **Resend** (invitation email) — behind small interfaces, logged or shown as bank details until real credentials are set

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase project keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**No hosted Supabase project yet?** See [supabase/localdev/README.md](supabase/localdev/README.md) — runs the whole app against your own local PostgreSQL with no Docker, using a natively-run PostgREST instead of a real Supabase project. Real RLS enforcement, not a shortcut; the one thing it can't do is real GoTrue (Supabase Auth has no Windows binary), so sign-in becomes a dev-only shortcut at `/dev-login` instead of magic-link email.

### Database

Schema lives in `supabase/migrations/`. Apply it against your Supabase project (via the SQL editor, or `supabase db push` with the Supabase CLI once linked).

- `0001_init.sql` — enums, `profiles`/`events`/`named_guests`/`rsvps`/`payments` tables, RLS policies, and the guest-limit trigger.
- `0002_storage.sql` — the `event-media` storage bucket + upload policies.
- `0016_profile_name.sql` — `profiles.display_name`, edited on `/dashboard/profile`.
- `0015_gmail_sender.sql` — `gmail_connections`, the encrypted Gmail tokens of organizers who chose to connect their account.
- `0014_free_model.sql` — the free, tip-supported model: no per-category guest limit, at most 5 live invitations per organizer, guarded `is_paid`/`expires_at`, per-device view counts (`event_views`), and `tips`.

### Applying migrations locally

Migrations are applied by hand, one file at a time, in number order. Nothing records which have run, so check first:

```
npx tsx scripts/migration-status.ts
```

It only reads, and lists each migration as `applied`, `MISSING` or `n/a` for the database in `LOCAL_DEV_PG_URL` (`.env.local`).

To apply one, run `psql` from the project folder. On this machine `psql` is not on the PATH, the database is `naashir_dev` and its user is `test_local_invite`; change those if yours differ. It asks for that user's password.

Command Prompt:

```bat
cd /d D:\Projects\Free_invite
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U test_local_invite -d naashir_dev -f supabase\migrations\0003_payment_providers.sql
```

PowerShell:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U test_local_invite -d naashir_dev -f supabase/migrations/0003_payment_providers.sql
```

Git Bash:

```bash
"/c/Program Files/PostgreSQL/16/bin/psql.exe" -U test_local_invite -d naashir_dev -f supabase/migrations/0003_payment_providers.sql
```

Swap the file name for each migration that is missing. Then tell PostgREST to pick up the new tables and columns, or the app keeps seeing the old schema until it restarts (Command Prompt form):

```bat
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U test_local_invite -d naashir_dev -c "NOTIFY pgrst, 'reload schema';"
```

Things to know:

- Lowest number first. Each `psql` call is one file; do not paste several files into one run.
- `0012` must finish before `0013` starts: it adds category values, and PostgreSQL will not let a later statement in the same run use them.
- Do not re-run `0001` to `0005` on a database that has them; they fail with "already exists". From `0006` on, re-running is harmless.
- `0006` shows as `n/a` on a local database set up before the stand-in for Supabase storage had the two columns it sets, and fails there with `column "file_size_limit" of relation "buckets" does not exist`. Nothing is changed by that error. To make it apply, add the columns once and run `0006` again (Command Prompt form):

  ```bat
  "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U test_local_invite -d naashir_dev -c "alter table storage.buckets add column if not exists file_size_limit bigint, add column if not exists allowed_mime_types text[];"
  "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U test_local_invite -d naashir_dev -f supabase\migrations\0006_cover_media_limits.sql
  ```

  It makes no difference to local development either way: local uploads are written to `public/uploads`, not to a bucket. A real Supabase project already has the columns.
- A line beginning `ERROR:` means that file did not apply. Stop there and fix it before the next.
- To skip the password prompt for one terminal session, set `PGPASSWORD` first (`set PGPASSWORD=...` in Command Prompt, `$env:PGPASSWORD="..."` in PowerShell, `export PGPASSWORD='...'` in Git Bash).

On a hosted Supabase project the same files are pasted into the SQL Editor, one at a time, in the same order.

### Sharing a Supabase project with another app

The migrations install into `public`. In a project where another app already uses `public`, Naashir goes into a schema of its own instead: `scripts/hosted-schema.ts` rewrites the migrations for it (`supabase/hosted/naashir/`, generated, not edited by hand), and the app is pointed there with `NEXT_PUBLIC_SUPABASE_DB_SCHEMA`. The steps, and what the two apps still share (accounts, sign-in email, limits), are in [docs/supabase-naashir-user.md](docs/supabase-naashir-user.md).

```bash
npx tsx scripts/hosted-schema.ts build           # after adding a migration
npx tsx scripts/hosted-schema.ts check           # fails if the generated files are stale
npx tsx scripts/verify-hosted-schema.ts          # installs them beside a stand-in "other app" and checks both
```

### Access model

- The **browser/anon** Supabase client is only used for organizer auth and the dashboard (RLS-scoped to `organizer_id = auth.uid()`).
- Everything guest-facing (public invite page, RSVP submit, named-guest link lookup, payment webhook, email send) goes through **server route handlers using the service-role key**, which bypasses RLS and enforces its own checks.
- Limits are enforced by **database triggers**, not just app logic, so they hold regardless of which client performs the write. See "Free model and limits" below.

## Free model and limits

Naashir is free to use and supported by tips. Nothing is sold, so the limits that remain exist to keep a free service affordable and hard to abuse. Each one is enforced in the database (`0014_free_model.sql`) and mirrored by a constant in `src/lib/event-types.ts`. `npx tsx scripts/verify-db.ts` fails if the two disagree.

| Limit | Value | Where |
| --- | --- | --- |
| Guests per invitation | none (a 5,000 safety ceiling, never shown) | `enforce_rsvp_limit` trigger, `RSVP_SAFETY_CEILING` |
| Live invitations per organizer | 5 unpaid and unexpired | `guard_event_insert` trigger, `MAX_LIVE_INVITATIONS` |
| Link lifetime | 7, 14 or 30 days, chosen at creation, fixed afterwards | `guard_event_insert` / `guard_event_expiry`, `LINK_LIFETIME_DAYS` |
| Emails per invitation | 10 | `FREE_EMAIL_SEND_LIMIT` (app only) |

The triggers apply to the end-user roles only. Anything done with the service-role key, including editing a row in the Supabase dashboard, is exempt: to take one of your own events out of every limit, set `is_paid = true` on it there.

### Signing in

The new-invitation form at `/create` is open to everyone. Signing in is asked for only when the visitor presses create: what they typed is parked in `localStorage` (`src/lib/create-stash.ts`), they sign in, and return to the form as they left it. The cover image cannot be parked and has to be chosen again. Guests never sign in.

### Cleanup of expired invitations

`GET /api/cron/cleanup` deletes free invitations that expired more than `EXPIRED_GRACE_DAYS` (7) ago, together with their uploaded covers and every guest, RSVP and view row. Without it the expiry only disables the link and nothing is ever freed.

- Set `CRON_SECRET`. The route refuses to run without it.
- On Vercel, `vercel.json` schedules it daily and Vercel sends the secret automatically.
- Anywhere else, have a scheduler call it once a day with `Authorization: Bearer <CRON_SECRET>`.

### View counts

The guest page reports each device once per visit to `/api/track`, and each use of the map and calendar buttons. The organizer sees devices, opens and button clicks on the event page. Counting is per device, with the same browser id the RSVP uses, so it over-counts one person on two phones and under-counts a shared computer.

### Email

An organizer can invite a guest by email in three ways, shown as buttons beside each guest who has an address.

| Button | Sent from | Limit | Needs |
| --- | --- | --- | --- |
| Gmail / Mail app | the organizer's own mail program | none | nothing |
| Send email | the site's address (Resend) | 10 per invitation | `RESEND_API_KEY` |
| Send from my Gmail | the organizer's Gmail, by the server | Gmail's own daily limit | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

The first two open a ready-written draft (`buildComposeLinks` in `src/lib/email/mime.ts`) and never touch this server.

"Send from my Gmail" appears only when the Google variables are set, and replaces "Send email" for an organizer who has connected their account. Setting it up:

1. In Google Cloud, create an OAuth client of type "Web application" and enable the Gmail API.
2. Add `<NEXT_PUBLIC_SITE_URL>/api/google/callback` as an authorised redirect URI.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and apply `0015_gmail_sender.sql`.

The only permission requested is `gmail.send`: the site can send as the organizer and cannot read their mail. Google classes that scope as sensitive, so until the OAuth app passes Google's verification it works only for accounts added as test users (at most 100) and shows a warning screen. Refresh tokens are stored encrypted (AES-256-GCM) in a table with no RLS policies, readable only with the service-role key.

The site's own sender is chosen in `getEmailProvider()` (`src/lib/email/index.ts`), which today returns Resend or, without a key, a logger. Every sender implements the same small `EmailProvider` interface, so adding Brevo or Mailjet is one new class there plus a variable to pick between them.

### Tips

`/tip` is linked from the header of every page. With the `QPAY_*` variables set it takes a tip of any amount through QPay; without them it shows the bank details in `TIP_BANK_*`, and with neither it says tipping is not available yet. Tips unlock nothing. A tipper may ask to be listed on the page's supporters list, which shows a name and message and never the amount.

## Tips (QPay)

Tips are the only money the site takes. They go through QPay, which does not
host a checkout page: `POST /invoice` returns a QR payload and a list of
per-bank deeplinks, and the site renders its own checkout from them.

1. `startTip` (`src/app/tip/actions.ts`) inserts a `pending` row in `tips`,
   creates the QPay invoice with the tip id as its number, and stores the QR,
   short URL and deeplinks on that row (`tips.checkout`).
2. The payer lands on `/tip/[tipId]`, which shows the QR and the bank-app
   buttons, and polls `/api/tips/check` while they pay.
3. QPay's callback at `/api/tips/webhook` is unauthenticated, so it is only a
   prompt. Both it and the polling end in `settleTip`, which asks QPay
   (`POST /payment/check`) before marking a tip paid.

Set `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET` and `QPAY_INVOICE_CODE` to turn
online tipping on. Without them the `/tip` page shows bank-transfer details
from `TIP_BANK_NAME`, `TIP_BANK_ACCOUNT` and `TIP_BANK_HOLDER`; without
those too it says tipping is not available yet. `QPAY_BASE_URL` points the
integration at QPay's sandbox while testing.

Tips unlock nothing, so a tip is never a payment for an invitation. The
`payments` table and migrations `0003` to `0005` are still in the database
from the old per-event upgrade; nothing reads or writes them now.

### Verifying the integration

QPay publishes no versioned OpenAPI spec and has renamed response fields
between merchant integrations, so the field names are confirmed by asking the
live API rather than by trusting the docs:

```bash
npx tsx scripts/verify-qpay.ts   # reads .env.local
```

It authenticates, creates one invoice, prints the response's shape (never the
credentials), checks the payment status, and deletes the probe invoice again.

Two things that probe established against a live merchant account, both of
which the code now depends on:

- **`expires_in` is an absolute Unix timestamp, not a duration**, despite the
  OAuth-style name. Treating it as a duration puts the token cache's expiry tens
  of thousands of years out, so the token is never refreshed and every call 401s
  permanently once QPay expires it for real. `expiryToEpochMs` handles both
  interpretations; the probe asserts the parsed expiry is believable.
- **`urls` comes back as an array of 23 bank deeplinks** (`qPay wallet`,
  `Khan bank`, `TDB`, `Social Pay`, `Monpay`, and so on), each with a name, a
  logo and a deeplink, and the QR arrives as `qr_image`/`qr_text` rather than
  the `qPay_QRimage`/`qPay_QRcode` spellings some integrations report. The
  parser accepts both spellings and `urls` in either array or object form.

What the probe does **not** cover is a real payment: nothing here has been
through an actual bank transfer, so the callback payload and the `PAID` row
shape from `/payment/check` are still unconfirmed. Make one small real tip
before relying on online tipping.

## Project structure

```
src/
  app/            routes (App Router)
  components/     templates, RSVP widget, share buttons
  lib/            supabase clients, slug/greeting/template logic, plan limits
supabase/
  migrations/     SQL schema + RLS + storage policies
docs/
  Naashir_Product_Plan_v1.md   product plan this app implements
```

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build (also type-checks)
npm run lint    # eslint
```

## Testing the database

(To see which migrations your own local database has, see "Applying migrations locally" above; this section is about the automated checks.)

The migrations and the guest-counting rule are the parts with no UI to eyeball,
so they are covered by a suite that runs against a local PostgreSQL:

```bash
cp .env.test.local.example .env.test.local   # set PGUSER / PGPASSWORD
npx tsx scripts/verify-db.ts
```

It creates a throwaway `naashir_test` database (never touching any other
database), applies `supabase/testing/shim.sql` plus every migration in order,
and then asserts the behaviour the app depends on — most importantly that **the
guest limit the app displays equals the limit the database enforces**, for every
event type. That check is not decorative: the two had already drifted apart once
for Kid's 1st Birthday, and reintroducing the drift makes the suite fail.

The role it connects as needs `LOGIN`, `CREATEDB` (for the throwaway database)
and `CREATEROLE` (for the temporary role used to exercise the RLS policies):

```sql
CREATE ROLE naashir_test WITH LOGIN PASSWORD '...' CREATEDB CREATEROLE;
```

`supabase/testing/shim.sql` is **test-only** and must never be applied to a real
Supabase project. It creates the objects Supabase supplies and plain Postgres
does not — `auth.users`, `auth.uid()`, the `storage` schema, and the `anon` /
`authenticated` / `service_role` roles — so the real migrations run *unmodified*
and are validated exactly as they will run in production.

> This validates the schema, not the app. `supabase-js` talks to Supabase's REST
> API rather than to Postgres directly, so running the app itself still requires
> a real Supabase project.

## Testing cover uploads

Invitation covers (JPG/PNG/WebP/GIF) are validated by sniffing the file's magic
bytes rather than trusting the browser-supplied MIME type, because the storage
bucket is public-read — a script uploaded as `photo.png` would be served from
the storage origin and execute there. That rule and the per-format size limits
(5 MB stills, 10 MB GIF) are covered by a suite needing no database or network:

```bash
npx tsx scripts/verify-cover-media.ts
```

It asserts the adversarial cases specifically: HTML and SVG declared as
`image/png` are rejected, and a still image renamed `.gif` cannot borrow the
larger GIF allowance. `supabase/migrations/0006_cover_media_limits.sql` applies
the same constraints at the bucket, for anything that bypasses the app.

## Testing links and the image proxy

Several fields take text an organizer typed and turn it into an `href`, an
`<img src>`, or an address our own server fetches: the map location, the video
link, the slider image links, and `/api/img`, which fetches external slider
images and crops them with sharp. Those rules have their own suite, with no
database or network:

```bash
npx tsx --conditions=react-server scripts/verify-links.ts
```

It covers the hostile cases: `javascript:` and `data:` links, plain-http images,
loopback / private-network / cloud-metadata addresses for the proxy, and
tampered or missing proxy signatures. `/api/img` only serves links signed with
`IMAGE_PROXY_SECRET` (falling back to `SUPABASE_SERVICE_ROLE_KEY`), so it cannot
be used as an open proxy.

## Brand assets

| Asset | Use |
|---|---|
| [`src/components/brand/Logo.tsx`](src/components/brand/Logo.tsx) | In-app logo. `LogoMark` (icon only) and `Logo` (icon + wordmark). Uses `currentColor`, so it adapts to light/dark automatically — prefer this inside the app. |
| [`src/app/icon.svg`](src/app/icon.svg) | Favicon / app icon. Picked up automatically by the Next.js `app/icon.svg` convention. |
| [`public/logo-mark.svg`](public/logo-mark.svg) | Standalone monoline mark for use outside the app (README, docs). Fixed colors. |
| [`public/logo-tile.svg`](public/logo-tile.svg) | Solid gradient tile version, for where the logo needs its own background (social avatar, app icon). |

The mark echoes the invitation card's own visual language (the flap fold and the
four-point ornament), so brand and product read as one design. Rendered at
16–64px in [docs/screenshots/logo-sizes.png](docs/screenshots/logo-sizes.png).

> When editing an `.svg` by hand, never use a double hyphen as a dash inside an
> XML comment — it is illegal in XML and silently breaks the entire file with a
> parse error rather than just ignoring the comment.

## Design constraints

Guests almost always open invitations on a phone, from a Messenger link — the
public invitation page is mobile-first, and **280px (the Galaxy Fold's outer
screen) is the narrowest supported width**. Layout changes should be checked
there, not just at a comfortable phone size:

```bash
npm run dev -- -p 3002
npm install --no-save playwright && npx playwright install chromium  # first run only
node scripts/screenshots.js
```

That writes `docs/screenshots/` and **exits non-zero on any horizontal page
overflow** or console error, at 280px / 390px / desktop. Current reference
screenshots live in [docs/screenshots/](docs/screenshots/). `playwright` is
deliberately not a project dependency — it would add a large browser download
to every install for a tool only needed when checking layout.
