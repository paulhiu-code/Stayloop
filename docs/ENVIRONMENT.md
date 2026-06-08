# StayLoop — Environment & Secrets (one-time setup)

This is the **single source of truth** for where every credential lives. Copy `docs/secrets.local.template.env` to `secrets.local.env` (gitignored), fill in rotated values once, then copy each value to the stores listed below.

> **Never commit `secrets.local.env`. Never paste secrets in Cursor chat.**

---

## One-time checklist

Do these in order. Check each box when done.

### Phase 1 — Rotate exposed credentials

These were shared in chat and **must be rotated** before reuse:

- [ ] **Supabase → Account → Access Tokens** — revoke old token, create new → `SUPABASE_ACCESS_TOKEN`
- [ ] **Supabase → Project Settings → API** — rotate **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
- [ ] **Supabase → Project Settings → Database** — reset database password → `SUPABASE_DB_PASSWORD` / `DATABASE_URL`
- [ ] **Vercel → Account Settings → Tokens** — revoke old token, create new → `VERCEL_TOKEN`

Optional but recommended during the same session (public-by-design, but refresh for hygiene):

- [ ] **Supabase → Project Settings → API** — rotate **anon public** key → `VITE_SUPABASE_ANON_KEY` (safe in browser; update Vercel + Cursor after rotate)

### Phase 2 — Populate secret stores

- [ ] Fill `secrets.local.env` from the template (local vault copy for you)
- [ ] **Cursor → [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents)** — Runtime Secrets + Environment Variables (see table below)
- [ ] **GitHub → Repository → Settings → Secrets and variables → Actions** — repository secrets for CI deploy
- [ ] **Vercel → Project → Settings → Environment Variables** — frontend `VITE_*` vars (Production)
- [ ] **Supabase → Edge Functions → Secrets** — email + PMS cron secrets

### Phase 3 — Verify automation

- [ ] Merge a PR to `main` and confirm GitHub Action **Deploy Production** succeeds
- [ ] Open https://stay-loop.co — homepage loads, auth works
- [ ] Run Cloud Agent task: “Deploy using dashboard secrets only” — agent completes without asking for keys

---

## Rotate vs do not rotate

| Variable | Rotate? | Why |
|----------|---------|-----|
| `SUPABASE_ACCESS_TOKEN` | **Yes — required** | Full Supabase management access; was exposed |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes — required** | Bypasses RLS; was exposed |
| `SUPABASE_DB_PASSWORD` / `DATABASE_URL` | **Yes — required** | Direct Postgres access; password was exposed |
| `VERCEL_TOKEN` | **Yes — required** | Deploy + env control; was exposed |
| `VITE_SUPABASE_ANON_KEY` | Optional once | Public in browser by design; rotate if doing a clean sweep |
| `VITE_SUPABASE_URL` | No | Public project URL |
| `SUPABASE_PROJECT_REF` | No | Public identifier (`glmzeapxusbsuhixhbqw`) |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | No | Project identifiers, not auth |
| `SITE_URL` / `CORS_ORIGIN` | No | Public URLs |
| `VITE_STRIPE_PUBLISHABLE_KEY` | No | Public Stripe key (`pk_...`) by design |
| `STRIPE_SECRET_KEY` | Only if ever exposed | Not shared in chat yet — set fresh when Stripe is configured |
| `STRIPE_WEBHOOK_SECRET` | Only if ever exposed | Set when Stripe webhooks are configured |
| `CRON_SECRET` / `PMS_CRON_SECRET` | Only if ever exposed | Generate new random strings if unsure |
| `RESEND_API_KEY` | Only if ever exposed | Set when enabling email |

---

## Where each secret goes

| Variable | Cursor Runtime Secret | GitHub Actions Secret | Vercel (Production) | Supabase Edge Secret | Notes |
|----------|:---------------------:|:---------------------:|:-------------------:|:--------------------:|-------|
| `SUPABASE_ACCESS_TOKEN` | ✅ | ✅ | — | — | Supabase CLI / migrations |
| `SUPABASE_DB_PASSWORD` | ✅ | ✅ | — | — | Used by `supabase db push` |
| `SUPABASE_PROJECT_REF` | env var | env var | — | — | `glmzeapxusbsuhixhbqw` |
| `VERCEL_TOKEN` | ✅ | ✅ | — | — | Vercel CLI deploy |
| `VERCEL_ORG_ID` | env var | ✅ | — | — | `team_YZZ17u8JTl0DtRyoSUixjqmc` |
| `VERCEL_PROJECT_ID` | env var | ✅ | — | — | `prj_4j9ygg0MIvJeN8PUoqZVxs2MEAko` |
| `VITE_SUPABASE_URL` | env var | — | ✅ | — | `https://glmzeapxusbsuhixhbqw.supabase.co` (no `/rest/v1/`) |
| `VITE_SUPABASE_ANON_KEY` | env var | — | ✅ | — | Public anon JWT |
| `VITE_API_BASE_URL` | env var | — | ✅ | — | Express API URL when hosted |
| `VITE_STRIPE_PUBLISHABLE_KEY` | env var | — | ✅ | — | Stripe `pk_...` when ready |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | — | — | **Never** in Vercel frontend |
| `DATABASE_URL` | ✅ | optional | — | — | Express API host only |
| `STRIPE_SECRET_KEY` | ✅ | optional | — | — | Express API host only |
| `STRIPE_WEBHOOK_SECRET` | ✅ | optional | — | — | Express API host only |
| `SUPABASE_URL` | env var | — | — | — | Same as VITE URL without path |
| `SUPABASE_ANON_KEY` | env var | — | — | — | Server-side auth validation |
| `SITE_URL` | env var | — | — | — | `https://stay-loop.co` |
| `CORS_ORIGIN` | env var | — | — | — | `https://stay-loop.co` |
| `ALLOWED_REDIRECT_ORIGINS` | env var | — | — | — | Stripe Connect redirects |
| `CRON_SECRET` | ✅ | optional | — | — | Express email cron |
| `PMS_CRON_SECRET` | ✅ | optional | — | ✅ | Scheduled PMS sync |
| `RESEND_API_KEY` | ✅ | optional | — | ✅ | Transactional email |
| `EMAIL_FROM` | env var | — | — | ✅ | e.g. `StayLoop <noreply@stay-loop.co>` |
| `EMAIL_REPLY_TO` | env var | — | — | ✅ | Optional support address |
| `PLATFORM_FEE_PERCENT` | env var | — | — | — | Default `10` |

**Cursor secret types**

- **Runtime Secret** — API keys, tokens, passwords (redacted in agent chat)
- **Environment Variable** — public URLs, project refs, non-sensitive config

---

## Cursor Cloud Agents setup

1. Open **[cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents)**.
2. Create environment **StayLoop Production** linked to `paulhiu-code/Stayloop`.
3. Add every ✅ **Runtime Secret** from the table using values from your filled `secrets.local.env`.
4. Add every **Environment Variable** from the table.
5. Save and start a **new** agent run (secrets load at VM start).

**Minimum set for autonomous deploys**

```
Runtime Secrets:
  SUPABASE_ACCESS_TOKEN
  SUPABASE_DB_PASSWORD
  SUPABASE_SERVICE_ROLE_KEY
  VERCEL_TOKEN

Environment Variables:
  SUPABASE_PROJECT_REF=glmzeapxusbsuhixhbqw
  VERCEL_ORG_ID=team_YZZ17u8JTl0DtRyoSUixjqmc
  VERCEL_PROJECT_ID=prj_4j9ygg0MIvJeN8PUoqZVxs2MEAko
  VITE_SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
  SITE_URL=https://stay-loop.co
  CORS_ORIGIN=https://stay-loop.co
  ALLOWED_REDIRECT_ORIGINS=https://stay-loop.co
```

Add payment/email/API secrets as you enable those features.

---

## GitHub Actions setup

**Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value source |
|-------------|--------------|
| `SUPABASE_ACCESS_TOKEN` | Rotated Supabase access token |
| `SUPABASE_DB_PASSWORD` | Rotated DB password |
| `VERCEL_TOKEN` | Rotated Vercel token |
| `VERCEL_ORG_ID` | `team_YZZ17u8JTl0DtRyoSUixjqmc` |
| `VERCEL_PROJECT_ID` | `prj_4j9ygg0MIvJeN8PUoqZVxs2MEAko` |

Optional (when features are live): `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `PMS_CRON_SECRET`.

Workflows:

- **CI** (`.github/workflows/ci.yml`) — runs on every PR: typecheck, lint, build
- **Deploy Production** (`.github/workflows/deploy-production.yml`) — runs on push to `main`: Supabase migrations + edge functions + Vercel production

---

## Vercel frontend variables

**Project → stayloop → Settings → Environment Variables → Production**

```
VITE_SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
VITE_SUPABASE_ANON_KEY=<your-rotated-anon-key>
VITE_API_BASE_URL=<your-express-api-url-or-empty-until-hosted>
VITE_STRIPE_PUBLISHABLE_KEY=<pk_... when Stripe is ready>
```

Also set **Preview** and **Development** if you use Vercel preview deployments.

---

## Supabase Edge Function secrets

**Project → Edge Functions → Secrets** (or CLI: `supabase secrets set KEY=value`)

```
RESEND_API_KEY=<re_...>
EMAIL_FROM=StayLoop <noreply@stay-loop.co>
EMAIL_REPLY_TO=support@stay-loop.co
PMS_CRON_SECRET=<random-string>
STAYLOOP_SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
STAYLOOP_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

After setting secrets, redeploy functions (`./scripts/deploy-supabase.sh` or merge to `main`).

**Auth redirect URLs:** Supabase → Authentication → URL configuration → add `https://stay-loop.co/**` and Vercel preview URLs.

---

## Express API host (future — Stripe + cron)

When you add a Node host (Railway, Render, Fly.io, etc.), set server-side vars there — **not** in Vercel frontend:

```
DATABASE_URL=postgresql://postgres:<password>@db.glmzeapxusbsuhixhbqw.supabase.co:5432/postgres
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SITE_URL=https://stay-loop.co
CORS_ORIGIN=https://stay-loop.co
ALLOWED_REDIRECT_ORIGINS=https://stay-loop.co
CRON_SECRET=<random-string>
PORT=4000
NODE_ENV=production
```

Add that host's deploy token to Cursor Runtime Secrets when ready.

---

## Local development (optional)

```bash
cp docs/secrets.local.template.env secrets.local.env
# fill in values
cp secrets.local.env .env.local   # Vite reads VITE_* from here
```

Run `npm run dev` for frontend. Run `npm run server` with server vars exported for API testing.

---

## Updating a key later

1. Rotate at the **source** (Supabase/Vercel/Stripe dashboard).
2. Update `secrets.local.env` (your vault).
3. Update **Cursor Cloud Agents Secrets**.
4. Update **GitHub Actions secrets** (if used by deploy workflow).
5. Update **Vercel** or **Supabase Edge** (if applicable).
6. Restart any running Cloud Agent.

You do **not** need to change code unless variable **names** change.

---

## Quick verification

```bash
# Frontend build (uses VITE_* from env)
npm run build

# Supabase connectivity
npx supabase projects list   # needs SUPABASE_ACCESS_TOKEN

# Vercel connectivity
npx vercel whoami            # needs VERCEL_TOKEN

# Production health
curl -s https://stay-loop.co | head
curl -s https://glmzeapxusbsuhixhbqw.supabase.co/functions/v1/send-email
```

---

## Related files

| File | Purpose |
|------|---------|
| `docs/secrets.local.template.env` | Fill-in template (safe to commit) |
| `secrets.local.env` | Your filled copy (**gitignored**) |
| `.env.example` | Developer reference |
| `AGENTS.md` | Cursor agent behavior rules |
| `.cursor/environment.json` | Cloud Agent install/bootstrap |
| `DEPLOYMENT.md` | Manual deploy reference |
