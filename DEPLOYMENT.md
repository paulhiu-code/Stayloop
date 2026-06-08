# StayLoop Deployment Guide

## Architecture

StayLoop runs on **one Vercel project**:

| Layer | Location |
|-------|----------|
| React frontend | Vercel static build (`dist/`) |
| Stripe + payments API | Vercel serverless functions (`/api/*`) |

No separate Render/Railway host is required.

For **local development**, you can still run the Express server with `npm run server` (port 4000) and set `VITE_API_BASE_URL=http://localhost:4000`.

## Before deploying

1. Merge the latest StayLoop PR into `main`.
2. Create or open your Supabase project.
3. Apply all migrations in `supabase/migrations` (especially `20260517000000_stripe_connect.sql` and `20260606120000_revshare_fixes.sql`).

## Deploy on Vercel

1. Go to https://vercel.com and import the StayLoop GitHub repo.
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables (see below).
6. Deploy.

## Environment variables (Vercel)

### Frontend (public — `VITE_` prefix)

| Variable | Example |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |

`VITE_API_BASE_URL` is **optional** on Vercel — the app calls `/api/...` on the same domain.

### Server (secret — no `VITE_` prefix)

| Variable | Where to get it |
|----------|-----------------|
| `DATABASE_URL` | Supabase → Database → **Session pooler** connection string |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → signing secret |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` |

**Never** put `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in a `VITE_` variable.

## Stripe webhook setup

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://<your-vercel-domain>/api/stripe/webhook`
3. Subscribe to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `account.updated`
4. Copy the **signing secret** (`whsec_...`) → Vercel env `STRIPE_WEBHOOK_SECRET`
5. Redeploy Vercel after adding the secret

Without the webhook, payments succeed in Stripe but bookings stay `pending` in Supabase.

## After deploying

1. Open `https://<your-vercel-domain>/api/health` — should return `"status": "ok"`.
2. Open `https://<your-vercel-domain>/api/health/db` — should return `"ok": true`.
3. Sign up / sign in on the site.
4. In Supabase Auth settings, add your Vercel domain to allowed redirect URLs.
5. Host: complete Stripe Connect onboarding at `/host-onboarding`.
6. Guest: test checkout with card `4242 4242 4242 4242`.

## Local development

```bash
# Terminal 1 — frontend
npm run dev

# Terminal 2 — API (optional; or use `npx vercel dev` for serverless locally)
npm run server
```

If using `npm run server`, set in `.env.local`:

```
VITE_API_BASE_URL=http://localhost:4000
```

For local webhooks:

```bash
stripe listen --forward-to localhost:4000/api/stripe/webhook
# or with vercel dev:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## OwnerRez production note

The PMS screen is present in the app, but the OwnerRez self-serve OAuth flow still needs production credentials and callback URLs.
