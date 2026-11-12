# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Naashir: organizers create animated event invitations, share the link (mostly via Messenger), and watch RSVPs on a dashboard. Free, tip-supported. Next.js 16 App Router + React 19 + Tailwind v4 + Supabase. README.md is detailed and authoritative; read the relevant section before touching email, tips (QPay), migrations, or uploads.

## Commands

```bash
npm run dev            # dev server
npm run build          # production build; also the type-check
npm run lint           # eslint
```

There is no unit-test runner. Verification is a set of standalone `tsx` scripts, each runnable on its own:

```bash
npx tsx scripts/verify-db.ts                     # throwaway naashir_test DB: applies shim + all migrations, asserts RLS/triggers and that DB limits match src/lib/event-types.ts (needs .env.test.local)
npx tsx scripts/verify-cover-media.ts            # upload magic-byte sniffing / size limits (no DB)
npx tsx --conditions=react-server scripts/verify-links.ts   # safe-link + /api/img proxy SSRF/signature rules (no DB)
npx tsx scripts/hosted-schema.ts build           # regenerate supabase/hosted/naashir/ after adding a migration
npx tsx scripts/hosted-schema.ts check           # fails if generated hosted files are stale
npx tsx scripts/verify-hosted-schema.ts
npx tsx scripts/migration-status.ts              # which migrations the local DB (LOCAL_DEV_PG_URL) has
node scripts/screenshots.js                      # layout check at 280px/390px/desktop; needs dev on :3002 and playwright installed with --no-save
```

## Architecture

**Two Supabase access paths — keep them separate.**
- `src/lib/supabase/server.ts` / `client.ts`: anon key + user session, RLS-scoped to `organizer_id = auth.uid()`. Use for all dashboard/organizer reads and writes.
- `src/lib/supabase/admin.ts`: service-role, bypasses RLS, `server-only`. Used only by guest-facing server code (`/i/[slug]`, `/api/rsvp`, `/api/track`, tips webhook, email send, cron cleanup), which must do its own authorization (slug match, signed tokens). Guests never sign in.
- `src/proxy.ts` is Next 16's renamed middleware; it only refreshes the Supabase session cookie.

**Limits live in the database.** Postgres triggers in `supabase/migrations/0014_free_model.sql` enforce live-invitation count, link lifetime, RSVP ceiling; the constants in `src/lib/event-types.ts` mirror them for display. Change both together — `verify-db.ts` fails on drift. Service-role writes are exempt from the triggers.

**Migrations** (`supabase/migrations/NNNN_*.sql`) are applied by hand in number order (psql locally, SQL editor on hosted); nothing tracks them. After adding one: run `hosted-schema.ts build` (the generated `supabase/hosted/naashir/` copy installs into a non-`public` schema selected by `NEXT_PUBLIC_SUPABASE_DB_SCHEMA`), update the hand-written `src/lib/supabase/types.ts` (use `type` aliases, not `interface`, or every `.from()` infers `never`), and locally `NOTIFY pgrst, 'reload schema'`. `supabase/testing/shim.sql` and `supabase/localdev/shim.sql` fake Supabase's `auth`/`storage` objects for plain Postgres — never apply them to a real project.

**Local dev mode** (`LOCAL_DEV_MODE=true`, see `supabase/localdev/README.md`): runs against local Postgres + a native PostgREST (`npm run dev:postgrest`, `.localdev/`) with no GoTrue. `src/lib/supabase/local-dev.ts` substitutes a signed-JWT cookie session and `/dev-login`; `next.config.ts` rewrites `/rest/v1/*` to PostgREST. Every Supabase call site is identical in both modes. Uploads go to `public/uploads` instead of Storage. The mode is forced off in production builds and on Vercel.

**Create flow.** `/create` is public; sign-in is requested only on submit. Form state is stashed in `localStorage` (`src/lib/create-stash.ts`) across the sign-in round-trip (cover file can't be stashed). `/dashboard/new` redirects to `/create`.

**Invitation rendering.** `src/lib/templates.ts` defines templates (palette, ornament motif, personality); `src/components/templates/InvitationCard.tsx` renders them, used by the public page `/i/[slug]`, `/preview`, `/demo`, and the dashboard. Event categories come from `EVENT_TYPES` in `src/lib/event-types.ts` and a Postgres enum (new categories need a migration).

**i18n.** Two locales, `mn` (default) and `en`, chosen by the `naashir_locale` cookie. All UI strings live in `src/i18n/dictionaries.ts`; add every key to both languages.

**Untrusted organizer input** that becomes an `href`, `<img src>`, or server fetch goes through `src/lib/safe-link.ts` / `src/lib/image-proxy.ts` (`/api/img` only serves HMAC-signed URLs). Covers are validated by magic bytes in `src/lib/cover-media.ts`, not MIME type.

**Pluggable providers.** Email: `getEmailProvider()` in `src/lib/email/index.ts` (Resend, or console logger without a key; per-organizer Gmail send via OAuth in `gmail.ts`). Tips: QPay in `src/lib/payments/qpay.ts`, falling back to bank details. The `payments` table and migrations 0003–0005 are legacy from a removed paid upgrade; nothing uses them.

## Conventions

- Dark mode is class-based (`.dark` on `<html>`, `@custom-variant dark` in `globals.css`), toggled by the user; colors for the page come from `--background`/`--foreground`, and dark-mode zinc shades are re-tinted there.
- The public invitation page is mobile-first; 280px is the narrowest supported width.
- In hand-edited SVGs, never put `--` inside an XML comment (breaks the whole file).
