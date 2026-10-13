# Deploying Naashir on Railway

The database is Supabase, and the Naashir tables are already installed there in the `naashir` schema. Railway runs only the Next.js app.

## Before you start

**Database: done**
- All 16 migrations are applied to the `naashir` schema (checked with `scripts/migration-status.ts --schema=naashir`).

**Supabase settings still to do**
1. Project Settings → API → **Exposed schemas**: add `naashir`. Until this is done, the API refuses every request for Naashir's tables.
2. Authentication → URL Configuration → **Redirect URLs**: add `https://<your-railway-domain>/auth/callback` (the domain is known after step 2 below; add it then).
3. Project Settings → API: copy the **anon / publishable** key and the **service-role / secret** key into `.env.local` (they are still placeholders there).

**Code**
- The commit `af6791f` is on your local `main` but not pushed. Railway deploys from GitHub, so push first. Tell me which repository to push to (`free_invite_site` is the new one).

## 1. Create the Railway service

1. Railway dashboard → **New Project** → **Deploy from GitHub repo** → pick the repository.
2. Railway detects Next.js and builds with `npm run build`. Check the service's **Settings → Build** and **Deploy**:
   - Build command: `npm run build`
   - Start command: `npm start`
3. Node version: Next.js 16 needs Node 20.9 or newer. Railway's default is recent enough; if the build complains, set a `NODE_VERSION` variable to `22`.

## 2. Create the public domain

Service → **Settings → Networking → Generate Domain**. You get `https://<name>.up.railway.app`. Keep it: it is the value for `NEXT_PUBLIC_SITE_URL` and the Supabase redirect URL.

## 3. Set the variables

Service → **Variables**. Use the values from `.env.local` (hosted block). Do not copy anything that starts with `LOCAL_DEV_`, `#`, or `NAASHIR_ADMIN_`.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wxtzkydcrwubjuwlkxzn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role / secret key from Supabase |
| `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` | `naashir` |
| `NEXT_PUBLIC_SITE_URL` | `https://<name>.up.railway.app` |
| `CRON_SECRET` | the value from `.env.local` (use a different one for production if you prefer) |
| `IMAGE_PROXY_SECRET` | the value from `.env.local` |
| `GMAIL_TOKEN_SECRET` | the value from `.env.local` |

Optional, only if you use them: `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`, `TIP_BANK_NAME`, `TIP_BANK_ACCOUNT`, `TIP_BANK_HOLDER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

`DATABASE_POOL_URL` is only for running scripts from your computer. The deployed app does not need it, so you can leave it out.

`NEXT_PUBLIC_` values are baked in at build time. After changing one, **redeploy**; a restart is not enough.

## 4. Deploy and allow the sign-in redirect

1. Deploy (Railway does this automatically after step 3, or click **Deploy**).
2. Open the **Deployments** log and wait for "Ready".
3. In Supabase → Authentication → URL Configuration: add `https://<name>.up.railway.app/auth/callback` to the redirect URLs, and set the **Site URL** to `https://<name>.up.railway.app`.

## 5. Schedule the daily cleanup

Expired invitations are deleted only when `/api/cron/cleanup` is called. On Railway, add a cron job:

1. Create a second service from the same repository, or use the service's **Cron Schedule** setting if your plan offers it, with:
   - Schedule: `0 20 * * *` (20:00 UTC every day)
   - Command: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<name>.up.railway.app/api/cron/cleanup`
2. Make sure the job has `CRON_SECRET` set (Variables).
3. Run it once by hand from the Railway dashboard, and check the response: `{"ok":true,...}`.

Railway's cron docs describe the exact screens; this step has not been tested on Railway yet.

## 6. Test in this order

1. Open `https://<name>.up.railway.app`: the home page loads.
2. Open `/create`, fill the form, press create: you are asked to sign in.
3. Enter your email, open the link from the sign-in email: you return to the form with your entries restored.
4. Create an invitation with a cover image; the dashboard shows it.
5. Open the invitation link in a private window, RSVP, and check the response on the dashboard.
6. `/tip` shows the bank details (or QPay if you set it up).

If sign-in emails do not arrive: Supabase's built-in email sender allows only a few emails per hour. Set a custom SMTP sender under Authentication → Emails before real users arrive.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails on `sharp` | native module on Linux | redeploy after `npm ci` succeeds; usually a Node version issue (step 1.3) |
| "Missing NEXT_PUBLIC_SUPABASE_URL" in the log | variable not set or set after the build | set it and redeploy |
| Every database request fails with a schema error | `naashir` not exposed | Supabase → Project Settings → API → Exposed schemas |
| Sign-in link goes to localhost | `NEXT_PUBLIC_SITE_URL` not set to the Railway address | set it, redeploy |
| Sign-in link says the redirect is not allowed | redirect URL missing in Supabase | add `/auth/callback` (step 4) |
| Expired invitations never disappear | cron not set up | step 5 |

## Costs

Railway charges for what the service uses (CPU, memory, network). A small Next.js app with light traffic costs a few US dollars a month. Supabase's free plan covers this project's database and sign-in while it stays small. Check both dashboards after the first week.
