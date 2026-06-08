# Stayloop

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-jkfqchxx)

StayLoop is a Vite + React + TypeScript marketplace backed by Supabase, with an Express API for Stripe and email automation.

## Production stack

| Layer | Host | Status |
|---|---|---|
| Frontend | [Vercel](https://stay-loop.co) | Live |
| Database + Auth | Supabase (`glmzeapxusbsuhixhbqw`) | Live |
| Edge Functions | Supabase (`send-email`, PMS sync) | Deployed |
| Express API | Not deployed yet | Pending Stripe setup |

## Development

| Task | Command |
|---|---|
| Install | `npm ci` |
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| API server | `npm run server` |

See `AGENTS.md` for Cloud Agent instructions and `DEPLOYMENT.md` for the full deploy checklist.

## Required environment variables

**Vercel (frontend)**

- `VITE_SUPABASE_URL` — `https://<project-ref>.supabase.co` (no `/rest/v1/` suffix)
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` — Express API URL (when deployed)
- `VITE_STRIPE_PUBLISHABLE_KEY` — when Stripe is configured

**Express API** (see `.env.example`)

- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (when Stripe is configured)
- `CRON_SECRET`, `SITE_URL`

## Repository branches

`main` is the single source of truth for production. Feature work should branch from `main` using `cursor/<description>-abc8`.

**Merged into main (safe to delete):** search/browse, Stripe Connect scaffold, OwnerRez PMS sync, Email CMS, category pills, email QA fixes, homepage crash fix, and related fix branches.

**Open for future work (not in main yet):**

| Branch | Purpose |
|---|---|
| `cursor/wire-up-runnable-backend-2375` | Rev-share fee engine, referral payouts, API deploy config |
| `cursor/schema-str-parity-2375` | Dashboard wiring, schema parity, manual properties |
| `cursor/resend-email-foundation-c899` | Host-scoped guest correspondence CMS |
| `cursor/guest-booking-sprint-a09d` | Booking schema cleanup + seed alignment |
| `cursor/supabase-cloud-setup-2375` | Supabase cloud setup guide + runnable API notes |

## CI

GitHub Actions runs lint, typecheck, and build on every push/PR to `main`.
