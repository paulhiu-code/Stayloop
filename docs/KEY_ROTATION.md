# StayLoop — Key rotation (start here)

Use this guide **once** to replace credentials that were exposed in chat. Work top to bottom. **Do not paste new keys into Cursor chat** — only into `.env.local` and the secret stores listed at the end.

**Project:** `glmzeapxusbsuhixhbqw`  
**Production:** https://stay-loop.co

---

## Before you start

- [ ] Block 30–45 minutes (site may briefly break until Step 6 redeploy completes)
- [ ] Copy `docs/secrets.local.template.env` → `.env.local` in the repo root
- [ ] Have Supabase, Vercel, and Stripe dashboards open in browser tabs

---

## Step 1 — Supabase database password (required)

1. Open [Supabase Database Settings](https://supabase.com/dashboard/project/glmzeapxusbsuhixhbqw/settings/database)
2. Click **Reset database password**
3. Save the new password in a password manager
4. In `.env.local`, set:
   ```
   DATABASE_URL=postgresql://postgres:NEW_PASSWORD@db.glmzeapxusbsuhixhbqw.supabase.co:5432/postgres
   ```

**Why:** The old DB password was exposed in chat.

---

## Step 2 — Supabase service_role key (required)

1. Open [Supabase API Settings](https://supabase.com/dashboard/project/glmzeapxusbsuhixhbqw/settings/api)
2. Under **Project API keys** → **service_role** → **Generate new key** (or rotate)
3. Copy the new key to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<new key>
   ```
4. Also set in [Edge Function Secrets](https://supabase.com/dashboard/project/glmzeapxusbsuhixhbqw/settings/functions):
   - `STAYLOOP_SUPABASE_SERVICE_ROLE_KEY` = same value
   - `SUPABASE_SERVICE_ROLE_KEY` = same value (if present)

**Why:** Service role bypasses all RLS — must never stay leaked.

---

## Step 3 — Supabase anon key (recommended in same session)

1. Same [API Settings](https://supabase.com/dashboard/project/glmzeapxusbsuhixhbqw/settings/api) page
2. Rotate **anon public** key (or generate new publishable key if using new Supabase key format)
3. In `.env.local`, set **both** to the same value:
   ```
   SUPABASE_ANON_KEY=<new anon key>
   VITE_SUPABASE_ANON_KEY=<same new anon key>
   SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
   VITE_SUPABASE_URL=https://glmzeapxusbsuhixhbqw.supabase.co
   ```

**Why:** Public in browser by design, but rotate once while doing a clean sweep.

---

## Step 4 — Supabase access token (required)

1. Open [Supabase Access Tokens](https://supabase.com/dashboard/account/tokens)
2. **Revoke** the old token (the one shared in chat)
3. Create a **new** token → copy to `.env.local`:
   ```
   SUPABASE_ACCESS_TOKEN=<new sbp_... token>
   ```

**Used for:** Cursor agents and GitHub Actions running `supabase db push` / function deploys. **Not** stored on Vercel.

---

## Step 5 — Vercel token (required)

1. Open [Vercel Account Tokens](https://vercel.com/account/tokens)
2. **Delete** the old token shared in chat
3. Create a new token → copy to `.env.local`:
   ```
   VERCEL_TOKEN=<new token>
   VERCEL_ORG_ID=team_YZZ17u8JTl0DtRyoSUixjqmc
   VERCEL_PROJECT_ID=prj_4j9ygg0MIvJeN8PUoqZVxs2MEAko
   ```

**Used for:** CLI deploys and `configure-vercel-env.mjs`. **Not** baked into the frontend.

---

## Step 6 — Push new values to Vercel & redeploy (required)

From the repo root (with `.env.local` filled from Steps 1–3 and Stripe vars if unchanged):

```bash
node --env-file=.env.local scripts/configure-vercel-env.mjs
```

Then either:

- **Vercel UI:** [Deployments](https://vercel.com/paul-hiu-s-projects/stayloop) → latest → **Redeploy**, or
- **CLI:** `npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"`

**Verify:**

```bash
curl -s https://stay-loop.co/api/health
curl -s https://stay-loop.co/api/health/db
```

Expect `"databaseConfigured": true` and `"ok": true` for DB.

---

## Step 7 — Stripe keys (only if ever exposed)

Production Stripe is in **test mode** and working. Rotate **only if** you pasted `sk_...` or `whsec_...` in chat:

1. [Stripe Dashboard → API keys](https://dashboard.stripe.com/test/apikeys) — roll secret key
2. [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks) → your `stay-loop.co` endpoint → roll signing secret
3. Update `.env.local` → re-run Step 6

Publishable key (`pk_...`) is public — no rotation needed unless you want a clean sweep.

---

## Step 8 — Cursor Cloud Agents secrets (required for autonomy)

Open [Cursor Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents)

Add as **Runtime Secret** (from `.env.local`, never chat):

| Name | From `.env.local` |
|------|-------------------|
| `SUPABASE_ACCESS_TOKEN` | Step 4 |
| `SUPABASE_DB_PASSWORD` | Step 1 (password only, not full URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 2 |
| `VERCEL_TOKEN` | Step 5 |
| `DATABASE_URL` | Step 1 |
| `STRIPE_SECRET_KEY` | if used |
| `STRIPE_WEBHOOK_SECRET` | if used |

Add as **Environment Variable**:

| Name | Value |
|------|-------|
| `SUPABASE_PROJECT_REF` | `glmzeapxusbsuhixhbqw` |
| `VERCEL_ORG_ID` | `team_YZZ17u8JTl0DtRyoSUixjqmc` |
| `VERCEL_PROJECT_ID` | `prj_4j9ygg0MIvJeN8PUoqZVxs2MEAko` |
| `VITE_SUPABASE_URL` | `https://glmzeapxusbsuhixhbqw.supabase.co` |
| `SITE_URL` | `https://stay-loop.co` |

Restart any running Cloud Agent after saving.

---

## Step 9 — GitHub Actions secrets (optional until deploy workflow merged)

When [PR #29](https://github.com/paulhiu-code/Stayloop/pull/29) or equivalent is merged:

**GitHub → Stayloop → Settings → Secrets and variables → Actions**

| Secret | Value source |
|--------|--------------|
| `SUPABASE_ACCESS_TOKEN` | Step 4 |
| `SUPABASE_DB_PASSWORD` | Step 1 |
| `VERCEL_TOKEN` | Step 5 |
| `VERCEL_ORG_ID` | `team_YZZ17u8JTl0DtRyoSUixjqmc` |
| `VERCEL_PROJECT_ID` | `prj_4j9ygg0MIvJeN8PUoqZVxs2MEAko` |

---

## Step 10 — Smoke test

1. Open https://stay-loop.co — homepage loads
2. Sign in (Supabase auth)
3. `curl https://stay-loop.co/api/health` — all flags `true`
4. Optional: run `npm run test:revshare` locally with `.env.local`

---

## Checklist summary

| # | Action | Required |
|---|--------|----------|
| 1 | Reset Supabase DB password | ✅ |
| 2 | Rotate service_role | ✅ |
| 3 | Rotate anon key | Recommended |
| 4 | Revoke old + create Supabase access token | ✅ |
| 5 | Revoke old + create Vercel token | ✅ |
| 6 | Run `configure-vercel-env.mjs` + redeploy | ✅ |
| 7 | Rotate Stripe (if exposed) | If applicable |
| 8 | Cursor Cloud Agents Secrets | ✅ |
| 9 | GitHub Actions secrets | When CI deploy enabled |
| 10 | Smoke test | ✅ |

---

## Related files

- `docs/secrets.local.template.env` — fill-in template
- `.env.local` — your local vault (gitignored)
- `scripts/configure-vercel-env.mjs` — pushes env to Vercel
- `docs/STRIPE_TESTING.md` — payment verification after rotation
