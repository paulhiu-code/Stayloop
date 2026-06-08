# Stayloop

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-jkfqchxx)

## Deploy

StayLoop is a Vite React app deployed to **Vercel** with **Supabase** for auth, database, and edge functions.

### One-time setup (secrets)

1. Read **[`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)** — full checklist, rotation guide, and where each key goes.
2. Copy **[`docs/secrets.local.template.env`](docs/secrets.local.template.env)** → `secrets.local.env` and fill in rotated values.
3. Upload secrets to **Cursor Cloud Agents**, **GitHub Actions**, **Vercel**, and **Supabase** per the doc.

### Autonomous deploys

- **Cursor Cloud Agents:** follow [`AGENTS.md`](AGENTS.md)
- **GitHub Actions:** merge to `main` → CI + Supabase + Vercel production deploy
- **Manual scripts:** `npm run deploy:supabase` / `npm run deploy:vercel`

### Required frontend env (Vercel Production)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (when Express API is hosted)
- `VITE_STRIPE_PUBLISHABLE_KEY` (when Stripe is configured)

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full deployment checklist.
