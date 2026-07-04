## What & why

<!-- Briefly describe the change and the motivation. Link any issue. -->

## Changes

<!-- Bullet the key changes. -->

-

## Testing

<!-- How was this verified? Include commands/output or screenshots for UI changes. -->

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Manually tested affected flows (or N/A)

## Merge safety checklist

<!-- Auto-merge only completes once all required checks are green. Confirm the risk-sensitive items. -->

- [ ] No secrets added to client code or `VITE_`-prefixed env vars
- [ ] New Supabase tables/migrations have RLS enabled with correctly scoped policies (or N/A)
- [ ] Stripe / PMS webhook handlers verify signatures before acting (or N/A)
- [ ] Payment / revenue-share / fee math and idempotency reviewed (or N/A)
- [ ] Bugbot review addressed (no unresolved high-severity findings)
