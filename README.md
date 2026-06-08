# Stayloop

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-jkfqchxx)

StayLoop is a Vite + React + TypeScript marketplace backed by Supabase, with Stripe Connect payments and rev-share on Vercel serverless.

**Live:** [stay-loop.co](https://stay-loop.co)

## Production stack

| Layer | Host | Status |
|-------|------|--------|
| Frontend + Stripe API | [Vercel](https://stay-loop.co) (`/api/*` serverless) | Live |
| Database + Auth | Supabase (`glmzeapxusbsuhixhbqw`) | Live |
| Edge Functions | Supabase (`send-email`, PMS sync) | Deployed |
| Stripe webhooks | `https://stay-loop.co/api/stripe/webhook` | Configured (test mode) |

## Quick start (development)

```bash
npm ci
cp .env.example .env.local   # fill in Supabase + Stripe test keys
npm run dev                  # frontend → http://localhost:5173
npm run server               # optional local API → http://localhost:4000
```

| Task | Command |
|------|---------|
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Rev-share tests | `npm run test:revshare` |

## Documentation

| Doc | Purpose |
|-----|---------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel + Supabase deploy checklist |
| [docs/STRIPE_TESTING.md](./docs/STRIPE_TESTING.md) | Stripe Connect + rev-share test guide |
| [AGENTS.md](./AGENTS.md) | Cloud Agent instructions |
| [.env.example](./.env.example) | Environment variable reference |

## Architecture

```
Browser → Vercel (React SPA + /api serverless)
              ↓
         Supabase (auth, Postgres, edge functions)
              ↓
         Stripe (Connect destination charges, webhooks)
```

- **Payments** run as Vercel serverless functions in `/api/` — no separate API host required.
- **Rev-share** logic lives in `server/fees.js` (canonical) with DB triggers + Stripe transfers in `server/revShare.js`.
- **Local dev:** set `VITE_API_BASE_URL=http://localhost:4000` and run `npm run server`.

## Environment variables (Vercel)

**Public (frontend):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`

**Secret (server — no `VITE_` prefix):** `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL`, `ALLOWED_REDIRECT_ORIGINS`

See `.env.example` for the full list. Use `scripts/configure-vercel-env.mjs` to push vars via Vercel API.

## Repository

- **`main`** — production source of truth (auto-deploys to Vercel)
- Feature branches: `cursor/<description>-<id>`
- CI: lint, typecheck, build on every push/PR to `main`

Merged feature work (Stripe Vercel API, rev-share, search, email CMS, OwnerRez PMS) is on `main`. Stale `cursor/*` branches can be deleted on GitHub when no longer needed.

## Stripe test mode checklist

1. `GET /api/health` → all configured flags `true`
2. Host completes Connect onboarding
3. Guest checkout with `4242 4242 4242 4242`
4. Booking `confirmed` in Supabase + payment in Stripe Dashboard

Full steps: [docs/STRIPE_TESTING.md](./docs/STRIPE_TESTING.md)
