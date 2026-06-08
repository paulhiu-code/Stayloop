# StayLoop — Cursor Cloud Agent Instructions

Use this file for autonomous development, security fixes, and deployments. **Never paste secrets in chat.** Read values from injected environment variables (Cursor Runtime Secrets) or `docs/ENVIRONMENT.md`.

## Before you change anything

1. Read `docs/ENVIRONMENT.md` for where each secret lives.
2. Confirm required env vars exist in the Cloud Agent environment (Secrets tab). If missing, ask the user to fill `docs/secrets.local.template.env` and upload to Cursor — do not ask for raw keys in chat.
3. Work on a `cursor/<task>-3fb6` branch; open a PR to `main` unless the user explicitly requests direct production deploy.

## Stack map

| Layer | Technology | Deploy target |
|-------|------------|---------------|
| Frontend | Vite + React | Vercel (`dist/`) |
| Auth + DB | Supabase Postgres + RLS | Supabase migrations |
| Edge logic | Supabase Edge Functions | `supabase functions deploy` |
| Payments API | Express (`server/`, `routes/`) | Separate Node host (not Vercel static) |
| Email | Resend via `send-email` function | Supabase Edge secrets |

## Commands

```bash
# Install & verify
npm install
npm run typecheck
npm run lint
npm run build

# Local frontend
npm run dev

# Local API (needs server-side secrets)
npm run server

# Supabase (needs SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD)
./scripts/deploy-supabase.sh

# Vercel production (needs VERCEL_TOKEN)
./scripts/deploy-vercel.sh
```

## Deployment rules

- **Frontend:** `./scripts/deploy-vercel.sh` or merge to `main` (GitHub Action runs automatically).
- **Database:** add migration under `supabase/migrations/`, then `./scripts/deploy-supabase.sh` or merge to `main`.
- **Edge functions:** included in `deploy-supabase.sh`. Functions with `verify_jwt = false` in `supabase/config.toml` must use `--no-verify-jwt`.
- **Never commit:** `.env`, `secrets.local.env`, real tokens, or service-role keys.
- **Never put in Vercel frontend env:** `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CRON_SECRET`.

## Security defaults (already in codebase)

- Booking totals are computed server-side (`routes/stripe.js`).
- Profile privilege columns protected by DB trigger.
- PMS webhooks require `x-stayloop-signature` HMAC.
- CORS requires explicit origin in production.
- Email template variables are HTML-escaped.

## When secrets are missing

Stop and tell the user which **variable names** are missing from Cursor/GitHub/Vercel/Supabase — refer them to `docs/ENVIRONMENT.md` checklist. Do not proceed with deploy commands that require those secrets.

## Pull request checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] No secrets in diff
- [ ] Migrations are idempotent and named with timestamp prefix
- [ ] Update `docs/ENVIRONMENT.md` if new env vars were introduced
