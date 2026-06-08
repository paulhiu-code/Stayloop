# AGENTS.md

## Cursor Cloud specific instructions

### Overview

StayLoop is a React + TypeScript SPA (Vite + Tailwind CSS) backed by Supabase (cloud BaaS). The frontend is a single-page application with no server-side rendering.

### Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite, default port 5173) |
| Lint | `npm run lint` (ESLint 9, flat config) |
| Type check | `npm run typecheck` (tsc --noEmit) |
| Build | `npm run build` |

### Environment variables

The app requires a `.env` file at the repo root with:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public API key

Without these, the Supabase client in `src/lib/supabase.ts` will throw at module load time. For local frontend development without a real Supabase project, provide any non-empty placeholder values; the UI will load but API calls will fail with network errors.

### Key gotchas

- Lint exits with warnings only on current `main` (React hook dependency warnings in a few components).
- Typecheck passes on current `main`.
- Supabase Edge Functions (under `supabase/functions/`) use the Deno runtime and import from `npm:` specifiers. They are not part of the Vite build; they must be deployed to Supabase separately using `supabase functions deploy`.
- No automated test suite exists (no test framework in `package.json`). Validation is lint + typecheck + manual browser testing.
- The `.env` file is gitignored. Each developer/agent must create their own.
