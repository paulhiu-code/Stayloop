# Bugbot review rules — StayLoop

StayLoop is a React + TypeScript (Vite) SPA on Supabase, with an Express payments/webhook server, Supabase Edge Functions, and Stripe Connect for host payouts. Because the app moves guest money and stores host/guest data, treat security and data-integrity issues as high severity.

## Always flag (high severity)

- **Secret leakage.** Any secret key committed to the repo, logged, returned in an API response, or shipped to the browser. Only `VITE_`-prefixed env vars may reach client code. `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, Stripe/PMS webhook secrets, and DB credentials must never appear in `src/**` or in any `VITE_` variable.
- **Missing Row Level Security.** New Supabase tables/migrations without RLS enabled, or policies that expose one user's data (bookings, profiles, messages, payouts) to another. Verify `USING`/`WITH CHECK` clauses scope rows to the authenticated user.
- **Privilege escalation via profile columns.** Direct client writes to privileged/admin columns. Prior migrations protect these (`protect_profile_privileged_columns`, `security_hardening`); flag changes that weaken those protections.
- **Unverified webhooks.** Stripe (`server/webhook.js`, `server/handlers/webhook.js`) and PMS (`pms-webhook-receiver`) handlers must verify the signature/secret before acting on the payload. Flag any handler that trusts an unverified body.
- **SQL / search injection.** User-supplied search terms must keep the existing LIKE-escaping (`search_like_escape` migration, `src/lib/search.ts`). Flag string-concatenated SQL or unescaped `LIKE`/`ILIKE` patterns.
- **Money-handling correctness.** Revenue-share/fee math (`server/revShare.js`, `server/fees.js`), currency units (cents vs dollars), rounding, and idempotency of payment/webhook handlers. Flag non-idempotent write paths that a retried webhook could double-apply.
- **AuthZ gaps.** Server routes that skip `server/lib/auth.js` / `server/lib/internalAuth.js` checks, or Edge Functions that don't validate the caller.

## Flag (medium severity)

- Missing input validation on server route / Edge Function payloads.
- Broad CORS (`supabase/functions/_shared/cors.ts`) that allows arbitrary origins for authenticated endpoints.
- Unhandled promise rejections or swallowed errors in payment/webhook/email paths.
- New dependencies with a materially larger footprint than needed, or unpinned versions.
- React effects with missing/incorrect dependency arrays that could cause stale data in booking/checkout flows.

## Project conventions

- Client data access goes through `src/lib/*` (`api.ts`, `booking.ts`, `property.ts`, etc.) — flag components that call Supabase directly instead of the lib layer.
- Edge Functions (`supabase/functions/**`) run on Deno and import from `npm:`/`https:` specifiers; they are deployed separately and are not part of the Vite build. Don't flag `npm:`/URL imports there as errors.
- The build must stay green under `npm run lint`, `npm run typecheck`, and `npm run build`. Flag changes that would break these.

## Don't flag

- Pre-existing React hook dependency **warnings** already present on `main` (they don't fail CI).
- `VITE_` public keys (Supabase anon key, Stripe publishable key) appearing in client code — these are meant to be public.
