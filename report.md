# Report: removing the paid upgrade and fixing audit findings

Date: 2026-10-13
Scope: Naashir is now free for every organiser and supported only by tips (donations). The per-event paid upgrade is removed. The business-flow audit findings that could be fixed in code were fixed. Nothing is committed or pushed.

## 1. Payment flow removed

Removed code:

- Upgrade page and action: `src/app/dashboard/[eventId]/upgrade/`.
- Paid checkout pages: `src/app/pay/` (mock and QPay). The shared QPay checkout component moved to `src/components/tip/QPayCheckout.tsx`, because tips still use it.
- Payment webhooks and status checks: `src/app/api/payments/` (QPay webhook, QPay check, Stripe webhook).
- Provider selection and Stripe: `src/lib/payments/index.ts`, `mock.ts`, `stripe.ts`, `mark-paid.ts`. The `stripe` npm package is uninstalled.
- Script: `scripts/verify-payments.ts`.
- Switches and constants: `PAYMENTS_ENABLED`, `PAID_PRICE_MNT`, `featuresUnlocked()`. Every page that checked them now behaves as the "free for everyone" branch, which is what it already did while the switch was off.
- Landing page: the pricing section and its comparison table. The "rules" section is always shown.
- Dashboard and edit page: upgrade links, the "payment received" banner, and the paid preview toggle on `/demo`.
- Dictionary (English and Mongolian): pricing, plan, comparison, upgrade and paid-preview keys, plus the `paid` status label.

Kept on purpose:

- QPay for tips: `src/lib/payments/qpay.ts` and `types.ts`, `/tip`, `/tip/[tipId]`, `/api/tips/*`. `createInvoice` now takes explicit `invoiceNo`, `callbackUrl` and `checkoutUrl`, so it no longer has upgrade-era defaults.
- Database: migrations 0001 to 0016 are untouched. The `payments` table and `events.is_paid` still exist. Nothing new writes to them.

Documentation:

- `README.md`: the Payments and Stripe sections are replaced by a "Tips (QPay)" section. The intro line and the closing advice were updated.
- `.env.example`: `PAYMENT_PROVIDER` and all `STRIPE_*` variables are removed. The QPay comment now refers to tipping.

## 2. Audit findings fixed

From the business-flow audit, in order of the audit:

| # | Finding | Status |
|---|---|---|
| 1 | Mock payment fallback could give free upgrades | Resolved by removing the payment flow. |
| 2 | `LOCAL_DEV_MODE` had no production guard | Fixed. `isLocalDevMode()` is false when `NODE_ENV` is `production` or `VERCEL` is set, whatever `LOCAL_DEV_MODE` says. `/dev-login` is then a 404 in deployed builds. Side effect: local dev mode now works only under `npm run dev`. `npm run build` followed by `npm start` on this machine runs as production and expects a real Supabase project. |
| 3 | Gmail sending skipped the expiry check | Fixed for expiry. `sendGuestEmail` refuses an expired invitation (error `expired`, with English and Mongolian text), which covers "Send email" and "Send from my Gmail". The two compose links (Gmail, Mail app) never reach the server, so the event page now hides all the email buttons once the link has expired. Copy link and Messenger share stay. The 10-email cap still does not apply to a connected Gmail account; see section 4. |
| 4 | Account deletion erased paid-event payment records | No new payment rows can be created, so this cannot grow. Not checked: whether the hosted database already holds `payments` rows or events with `is_paid = true` from earlier testing. Deleting such an account still deletes those rows. |
| 5 | No rate limiting on public endpoints | Not fixed. See section 4. |
| 6 | Tip names and messages not moderated | Not fixed. See section 4. |
| 7 | Email cap not atomic | Not fixed. See section 4. |
| 8 | Payment amounts not compared | No longer applies: the payment flow is removed. Tip amounts are bounded by `TIP_MIN_MNT` and `TIP_MAX_MNT`. |
| 9 | Cleanup depends on a scheduler | Not changed. `vercel.json` covers Vercel. Elsewhere, a scheduler must send `CRON_SECRET`. |

Copy fix: the email-limit message no longer says "Upgrade to send more." The English and Mongolian texts were updated. The expired-invitation text shown to guests no longer mentions upgrading.

## 3. Verification

- `npx tsc --noEmit`: passes.
- `npx eslint src scripts`: no errors, no warnings.
- `npx next build`: passes on the final code. The route list no longer includes `/pay`, `/api/payments` or the upgrade page.
- `scripts/verify-links.ts`: 99 passed, 0 failed.
- `scripts/verify-cover-media.ts`: 27 passed, 0 failed.
- `scripts/verify-db.ts`: ALL PASS, against the test database. It was run before the last two fixes (local dev guard, email expiry); neither touches SQL.
- Not run: `scripts/verify-qpay.ts`. It needs live QPay credentials and creates a real sandbox invoice. Run it once tipping is live.
- Not run: browser testing of the pages changed here.

Note: `.next/types` was cleared and regenerated with `npx next typegen`. It is build output and is not in git.

## 4. Known gaps, not fixed

- **Rate limiting** (finding 5). `/api/track`, `/api/rsvp` and the tip action are open. Each tip creates a QPay invoice. This needs a platform-level limit (Vercel firewall or a store such as Upstash), which is outside the code.
- **Tip moderation** (finding 6). Names and messages go onto `/tip` as soon as the tipper ticks the public box. A hide flag or manual approval is needed before wide promotion.
- **Email cap race** (finding 7). The 10-email count and the send are not atomic. Two sends at the same moment can pass the cap by one or two.
- **Gmail is uncapped.** A connected organiser can send unlimited invitations from their own account. Only Google's daily limit applies. Decide whether this is acceptable.
- **Cleanup scheduling** (finding 9). If the site is not on Vercel, nothing deletes expired invitations until a scheduler calls `/api/cron/cleanup` with `CRON_SECRET`.

## 5. Follow-up work

1. **Drop the `is_paid` concept.** No event can become paid through the site now. An operator can still set `is_paid = true` by hand in the database, and such an event never expires, is never cleaned up and has no email cap (README, "Free model and limits"). `is_paid` still appears in the expiry checks, the RSVP route, the cleanup query, the live-limit trigger (0014) and `verify-db.ts`. Removing it needs a migration, and the migration would destroy the column. Do it as a separate, reviewed step.
2. **Decide what to do with the `payments` table.** It has no code using it. Dropping it is destructive, so keep it until the decision is made.
3. **Old upgrade links return 404.** Any link to `/dashboard/<id>/upgrade` or `/pay/...` now shows the not-found page. Add redirects in `next.config.ts` if old links matter.
4. **Product plan document.** `docs/Naashir_Product_Plan_v1.md` still describes per-event pricing. It is a planning document, so it was not edited.
5. **Mongolian copy review.** The new Mongolian lines (email expired, email limit, expired invitation text) were written without a native review. Please read them, especially the wording for "a new invitation".
6. **Unused dictionary keys.** Ten keys have no reference in the source and predate this work: `common.appName`, `landing.eyebrow`, `landing.templatesTitle`, `landing.templatesSubtitle`, `landing.shelfLink`, `landing.shelfPrev`, `landing.shelfNext`, `newEvent.previewCoverNote`, `guests.guestSlotsUsed`, `demo.templateLabel`. They were left alone.
7. **Production environment check.** Confirm `LOCAL_DEV_MODE` is unset in the hosting environment, and that `PAYMENT_PROVIDER`, `STRIPE_*` and the old upgrade variables are removed there.

## 6. Git state

Nothing committed or pushed. The working tree has 28 modified and 14 deleted files, and two new files: `src/components/tip/QPayCheckout.tsx` and this report. Staging, committing and pushing wait for an explicit instruction.
