# StayLoop Deployment Guide

## Architecture

StayLoop runs on **one Vercel project** (frontend + API):

| Layer | Location |
|-------|----------|
| React frontend | Vercel static build (`dist/`) |
| Stripe + payments API | Vercel serverless (`/api/*`) |
| Database + Auth | Supabase |
| Transactional email | Supabase Edge Function (`send-email`) + Resend |

**Production URLs:** [stay-loop.co](https://stay-loop.co) · [stayloop-eta.vercel.app](https://stayloop-eta.vercel.app)

## Before deploying

1. Ensure `main` is up to date on GitHub (Vercel auto-deploys from `main`).
2. Apply Supabase migrations in `supabase/migrations/` in order.
   - Critical for Stripe: `20260517000000_stripe_connect.sql`, `20260606120000_revshare_fixes.sql`
   - Linked project: `supabase db push`
   - Or run each new file in the Supabase SQL editor.
3. Configure Vercel environment variables (see below).

## Vercel environment variables

### Public (frontend — `VITE_` prefix)

| Variable | Example |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |

`VITE_API_BASE_URL` is **optional** on Vercel — the app calls `/api/...` on the same domain.

### Secret (server — never use `VITE_` prefix)

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Supabase → Database → **Session pooler** connection string |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → signing secret |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` |
| `SITE_URL` | `https://stay-loop.co` |
| `ALLOWED_REDIRECT_ORIGINS` | `https://stay-loop.co,https://www.stay-loop.co` |

Push vars via API:

```bash
VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=prj_xxx node --env-file=.env.local scripts/configure-vercel-env.mjs
```

Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in `VITE_*` variables.

## Stripe webhook

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://stay-loop.co/api/stripe/webhook`
3. Scope: **Your account**
4. Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `account.updated`
5. Copy signing secret → Vercel `STRIPE_WEBHOOK_SECRET`
6. Redeploy Vercel

## After deploying

```bash
curl https://stay-loop.co/api/health
curl https://stay-loop.co/api/health/db
```

Expected: `"status":"ok"`, `"stripeConfigured":true`, `"databaseConfigured":true`.

Add your Vercel domain to Supabase Auth → URL configuration.

## Local development

```bash
npm run dev                              # frontend :5173
npm run server                           # Express API :4000 (optional)
```

For local API, set `VITE_API_BASE_URL=http://localhost:4000` in `.env.local`.

Local webhooks:

```bash
stripe listen --forward-to localhost:4000/api/stripe/webhook
```

## Email (Resend)

Transactional email uses the `send-email` Supabase Edge Function. Configure Resend secrets in Supabase Edge Function settings. See existing email CMS migrations in `supabase/migrations/`.

## Testing

See [docs/STRIPE_TESTING.md](./docs/STRIPE_TESTING.md) for the full Stripe + rev-share test checklist.
