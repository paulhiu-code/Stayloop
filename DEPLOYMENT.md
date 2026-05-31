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

Stripe Connect needs a Node/Express API host in addition to the Vercel frontend. Start the API with `npm run server`, then set these server-side environment variables:

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL` (optional; defaults to `https://stay-loop.co`)
- `PLATFORM_FEE_PERCENT` (optional; defaults to `10`)
- `PORT` (optional; defaults to `4000`)
- `CORS_ORIGIN` (optional; defaults to `*`)

Point Stripe webhooks at `POST /api/stripe/webhook`. On `payment_intent.succeeded`, the API confirms the booking and sends guest/host confirmation plus payment receipt emails via the CMS.

Never expose `STRIPE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in Vercel frontend environment variables.

## Email (Resend) setup

StayLoop sends transactional email through Resend via the `send-email` Supabase Edge Function.

1. Create a Resend account and verify your sending domain.
2. In Supabase → Project Settings → Edge Functions → Secrets, add:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` (example: `StayLoop <noreply@stay-loop.co>`)
   - `EMAIL_REPLY_TO` (optional; example: `support@stay-loop.co` once inbound MX is verified)
3. Deploy the `send-email` function.
4. Test the connection:

```bash
curl -s "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"test","to":"you@example.com"}'
```

For auth emails (signup verification and password reset), configure Supabase Auth SMTP with Resend:

- Host: `smtp.resend.com`
- Port: `465` (SSL) or `587` (STARTTLS)
- Username: `resend`
- Password: your `RESEND_API_KEY`
