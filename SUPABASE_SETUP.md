# Supabase Cloud Setup for StayLoop

Your Supabase project ref: **`glmzeapxusbsuhixhbqw`**

This guide walks you through connecting StayLoop to Supabase in the cloud and applying all database migrations.

---

## What you're setting up

| Piece | What it does |
|-------|----------------|
| **Postgres database** | Stores profiles, properties, bookings, PMS connections, etc. |
| **Auth** | Sign up / sign in (email + optional Google/Apple) |
| **Row Level Security (RLS)** | Guests can browse listings; users only see their own data |
| **Edge Functions** | OwnerRez/Guesty sync (deploy after migrations) |

The frontend talks to Supabase directly for most features. Stripe payments use a separate Node API (`server/index.js`).

---

## Step 1 — Collect credentials from Supabase Dashboard

Open: https://supabase.com/dashboard/project/glmzeapxusbsuhixhbqw

### A. API keys (Settings → API)

Copy these two values:

- **Project URL** → `https://glmzeapxusbsuhixhbqw.supabase.co`
- **anon public** key → safe to use in the frontend

Also copy the **service_role** key — server-side only, never commit or expose in the browser.

### B. Database password (Settings → Database)

If you haven't saved your database password, reset it under **Database password** and store it somewhere safe. You'll need it to link the CLI.

---

## Step 2 — Create your local `.env` file

In the project root, copy the example and fill in values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
VITE_SUPABASE_ANON_KEY=paste-your-anon-key-here

# Stripe API (separate server — configure later)
VITE_API_BASE_URL=http://localhost:4000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Optional: for verify script + server auth
SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
SUPABASE_ANON_KEY=paste-your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-your-service-role-key-here
```

`.env` is gitignored — it never gets committed.

---

## Step 3 — Install the Supabase CLI

Pick one:

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# npm (works everywhere)
npm install -g supabase
```

Verify:

```bash
supabase --version
```

---

## Step 4 — Log in and link your project

```bash
# Opens browser to authenticate
supabase login

# From the StayLoop repo root
cd /path/to/Stayloop
supabase link --project-ref glmzeapxusbsuhixhbqw
```

When prompted, enter your **database password** from Step 1B.

You should see: `Finished supabase link.`

---

## Step 5 — Push all migrations to the cloud

This creates every table, policy, trigger, and index StayLoop needs:

```bash
supabase db push
```

Expected: 7 migrations applied in order:

1. `20251008064057` — core schema (profiles, properties, bookings, …)
2. `20251008070000` — extra indexes
3. `20260514000000` — PMS integration tables
4. `20260514001000` — signup profile metadata trigger
5. `20260517000000` — Stripe Connect columns
6. `20260521000000` — anonymous guest browsing (properties + calendar)
7. `20260523000000` — PMS auto-sync defaults

Confirm in Dashboard → **Database → Migrations** — you should see all 7 listed.

### Alternative: no CLI

If the CLI won't install, open **SQL Editor** in the dashboard and run each file in `supabase/migrations/` **in timestamp order**, one file at a time. Use `db push` if you can — it's less error-prone.

---

## Step 6 — Verify the database

```bash
npm run verify:supabase
```

This checks tables, anon access, Stripe columns, and Edge Functions. Fix any ❌ before moving on.

Quick manual check in **SQL Editor**:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see: `availability_calendar`, `bookings`, `messages`, `pms_connections`, `pms_property_mappings`, `pms_sync_logs`, `pms_webhook_events`, `profiles`, `properties`, `referral_earnings`, `reviews`.

---

## Step 7 — Configure Auth redirect URLs

Dashboard → **Authentication → URL Configuration**

Add your site URLs to **Redirect URLs**:

- `http://localhost:5173` (local Vite dev)
- `https://your-vercel-app.vercel.app` (production)
- Any custom domain you use

For **Site URL**, set your primary production URL (or `http://localhost:5173` while developing locally).

---

## Step 8 — Deploy Edge Functions (PMS sync)

After migrations succeed:

```bash
supabase functions deploy pms-ownerrez-sync
supabase functions deploy pms-guesty-sync
supabase functions deploy pms-webhook-receiver
supabase functions deploy pms-scheduled-sync
```

Set secrets the functions need (Dashboard → Edge Functions → Secrets, or CLI):

```bash
supabase secrets set STAYLOOP_SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
supabase secrets set STAYLOOP_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

For scheduled sync, create a **Cron Job** in the dashboard that POSTs to  
`https://glmzeapxusbsuhixhbqw.supabase.co/functions/v1/pms-scheduled-sync`  
every 6 hours with header `x-stayloop-cron-secret: your-secret`.

---

## Step 9 — Test the frontend locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

- Homepage should load (showcase cards if no properties yet)
- Sign up → should create a row in `profiles` automatically
- After adding a property as a host, it should appear on the homepage

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Missing Supabase environment variables` in browser | Check `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, restart `npm run dev` |
| Migrations fail mid-way | Read the error in terminal; fix SQL; run `supabase db push` again |
| Can't browse properties logged out | Ensure migration `20260521000000` applied (anon policies) |
| Sign up works but no profile | Check trigger `on_auth_user_created` exists (SQL: `\dft` in psql or Triggers in dashboard) |
| `supabase link` fails | Confirm project ref and database password |

---

## What's next after Supabase

1. **Auth** — test sign up, sign in, profile load  
2. **Stripe API** — run `npm run server` with Stripe keys for payments  
3. **Vercel** — deploy frontend with the same `VITE_*` env vars  
4. **OwnerRez** — connect PMS once hosting is live  
