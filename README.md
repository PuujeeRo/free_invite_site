# Naashir

Create an animated event invitation in a few clicks, share the link on Messenger, and watch guest RSVPs come in on a live dashboard. See [docs/Naashir_Product_Plan_v1.md](docs/Naashir_Product_Plan_v1.md) for the full product plan (pricing, guest-limit rules, build order).

## Stack

- **Next.js** (App Router, TypeScript, Tailwind CSS v4)
- **Supabase** — Postgres, Auth (magic link), Storage
- **QPay/SocialPay** and **Resend** — pluggable, behind provider interfaces (mocked/log-only until real credentials are set)

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

### Access model

- The **browser/anon** Supabase client is only used for organizer auth and the dashboard (RLS-scoped to `organizer_id = auth.uid()`).
- Everything guest-facing (public invite page, RSVP submit, named-guest link lookup, payment webhook, email send) goes through **server route handlers using the service-role key**, which bypasses RLS and enforces its own checks.
- The free-plan guest limit (10 or 100 depending on event type) is enforced by a **database trigger** on `rsvps`, not just app logic, so it can't be bypassed regardless of which key performs the insert.

## Payments (QPay)

QPay is not a hosted-checkout gateway. Its `POST /invoice` call returns a QR
payload plus a list of per-bank deeplinks, and the merchant renders its own
checkout surface from them, so this app does exactly that:

1. `startCheckout` inserts a `pending` payment row, calls QPay, and stores the
   returned QR image, QR text, short URL and bank deeplinks on that row
   (`payments.checkout`, added in `0004_qpay_checkout.sql`).
2. The organizer lands on `/pay/qpay/[paymentId]`, a server-rendered page
   scoped by RLS to the organizer who owns the event. It shows the QR and a
   grid of bank-app buttons.
3. Confirmation arrives on two independent paths, because either one alone
   leaves a real gap:
   - `/api/payments/qpay/webhook` is QPay's server-to-server callback. The ping
     is unauthenticated, so it is only ever treated as a hint to re-check the
     real status via `POST /payment/check`.
   - `/api/payments/qpay/check` is polled by the checkout page (every 3s, and
     immediately when the tab becomes visible again, which is the moment the
     payer returns from their banking app). It runs the same `/payment/check`
     verification, so the upgrade unlocks on the screen the organizer is
     actually looking at instead of after a manual refresh.

Both paths funnel into the same idempotent `markPaymentPaid`, so a payment
confirmed twice flips the event to paid exactly once.

Set `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET` and `QPAY_INVOICE_CODE` to activate
it. With them unset the mock provider takes over and drives the same flow
through a local checkout page. `QPAY_BASE_URL` points the integration at QPay's
sandbox while testing.

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
shape from `/payment/check` are still unconfirmed. Make one small real payment
before taking money from customers.

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

## Payments

Providers sit behind one interface (`src/lib/payments/`), selected by
`PAYMENT_PROVIDER` (`qpay` | `stripe` | `mock`) or auto-detected from whichever
credentials are present. With none set, the mock provider drives a local
checkout page so the whole flow works in dev.

| Provider | Notes |
|---|---|
| `qpay` | Primary, MNT. Callback is unauthenticated, so `/api/payments/qpay/webhook` re-checks the real status via QPay's API before marking anything paid. Not yet tested against a live merchant account. |
| `stripe` | Structure only, no account yet. Checkout Session + signature-verified webhook at `/api/payments/stripe/webhook`. |
| `mock` | Dev default. Exercises the real create → pay → confirm path via `/pay/mock/[paymentId]`. |

A pinned provider whose credentials are missing throws rather than falling back
to `mock` — a misconfigured deploy must fail loudly, not quietly give away free
upgrades.

```bash
npx tsx scripts/verify-payments.ts   # currency conversion + provider selection
```

### Before using Stripe, check these

Stripe is wired up but **is not usable for the 999₮ per-event price**, for
reasons that are commercial rather than technical:

- **999₮ is below Stripe's minimum charge.** ~999₮ is roughly USD 0.28, under
  Stripe's ~USD 0.50 minimum, so the charge would be rejected outright.
- **Fees would exceed the payment.** At roughly 2.9% + USD 0.30, the fee alone
  is larger than the whole 999₮.
- **Mongolia is not a supported Stripe country.** Stripe accounts require a
  business in one of its supported countries, which does not include Mongolia —
  using it means incorporating elsewhere.
- **MNT as a Stripe presentment currency is unverified.** `STRIPE_CURRENCY`
  defaults to `MNT`, but confirm Stripe actually supports it for your account
  before relying on it; otherwise set a supported currency.

Where Stripe *does* fit: the Phase 2 **49,000₮/year business plan** in the
[product plan](docs/Naashir_Product_Plan_v1.md) (~USD 14, comfortably above the
minimum), or taking international card payments. QPay/SocialPay remain the right
rails for the core 999₮ Mongolian flow.

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
