# StayLoop Deployment Guide

## Recommended host

Use Vercel for the StayLoop frontend. This project is a Vite React app, so Vercel should build the site with `npm run build` and publish the `dist` directory.

## Before deploying

1. Merge the latest StayLoop PR into `main`.
2. Create or open your Supabase project.
3. Apply the Supabase migrations in `supabase/migrations`.
4. Copy these values from Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Do not use the placeholder values from `.env`.

## Deploy on Vercel

1. Go to https://vercel.com.
2. Sign in with GitHub.
3. Click **Add New... → Project**.
4. Import the `Stayloop` GitHub repository.
5. Use these settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
6. Add these environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL`
   - `VITE_STRIPE_PUBLISHABLE_KEY`
7. Click **Deploy**.

## After deploying

1. Open the generated Vercel URL and confirm the homepage loads.
2. Sign up or sign in.
3. Confirm dashboard access.
4. Confirm search and featured listings render.
5. In Supabase Auth settings, add your Vercel domain to allowed redirect URLs.
6. When ready, connect your custom domain.

## OwnerRez production note

The PMS screen is present in the app, but the OwnerRez self-serve OAuth flow still needs production credentials and callback URLs. Once the production domain is live, use it when configuring OwnerRez OAuth redirect URLs.

## Stripe production note

Stripe Connect needs a Node/Express API host in addition to the Vercel frontend. The runnable server lives at `server/index.js` (it mounts `routes/stripe.js`, verifies Supabase sessions, and handles the Stripe webhook). Start it with `npm run server`, point the frontend's `VITE_API_BASE_URL` at it, then set these server-side environment variables:

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` (used to verify guest/host sessions)
- `PLATFORM_FEE_PERCENT` (optional; defaults to `10`)
- `PORT` (optional; defaults to `4000`)
- `CORS_ORIGIN` (optional; defaults to `*` — set to your Vercel domain in production)

Configure a Stripe webhook endpoint pointing at `https://your-api-domain.com/api/stripe/webhook` and subscribe to `payment_intent.succeeded`, `payment_intent.payment_failed`, and `account.updated`. The signing secret Stripe generates is your `STRIPE_WEBHOOK_SECRET`. Without this webhook, bookings stay `pending` even after a successful payment.

Never expose `STRIPE_SECRET_KEY` in Vercel frontend environment variables.
