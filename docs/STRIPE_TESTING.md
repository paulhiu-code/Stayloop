# Stripe + Rev-Share Testing Guide

Use this checklist to verify StayLoop payments end-to-end in **Stripe test mode**.

## Infrastructure status

| Check | URL / command | Expected |
|-------|----------------|----------|
| API health | `https://stay-loop.co/api/health` | `stripeConfigured`, `databaseConfigured`, `supabaseAuthConfigured` all `true` |
| Database | `https://stay-loop.co/api/health/db` | `"ok": true` |
| Stripe | `https://stay-loop.co/api/health/stripe` | `"mode": "test"` |
| Webhook | Stripe Dashboard → Webhooks | `https://stay-loop.co/api/stripe/webhook` — events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `account.updated` |

## Automated tests (local)

```bash
# Fee math + DB referral accrual (24 assertions)
npm run test:revshare

# Optional: live Stripe test charges
npm run test:revshare -- --stripe
npm run test:revshare -- --stripe-referrals
```

Requires `.env.local` with `DATABASE_URL`, `STRIPE_SECRET_KEY`.

## Manual test flow

### 1. Host Connect onboarding

1. Sign in as a **host** at [stay-loop.co](https://stay-loop.co)
2. Dashboard → **Connect Stripe** (or `/host-onboarding`)
3. Complete Stripe Express **test** onboarding
4. Confirm dashboard shows payouts active (`stripe_charges_enabled = true`)

Test data: [Stripe Connect testing docs](https://docs.stripe.com/connect/testing)

### 2. Guest checkout

1. Sign in as a **guest** (or use incognito)
2. Open a property with an onboarded host
3. Select dates → **Reserve** → checkout
4. Pay with test card **`4242 4242 4242 4242`** (any future expiry, any CVC)
5. Confirm UI shows **Booking confirmed**

### 3. Verify in Stripe Dashboard

- **Payments** — destination charge succeeded
- **Application fee** — platform fee collected
- **Connect → Transfers** — host received their share

### 4. Verify in Supabase

```sql
SELECT id, status, stripe_payment_intent_id, host_payout, platform_fee_amount
FROM bookings
ORDER BY created_at DESC
LIMIT 5;
```

Expected: `status = 'confirmed'` after payment.

### 5. Rev-share (optional)

Fee model (single source of truth: `server/fees.js`, `src/lib/fees.ts`):

| Party | Share |
|-------|-------|
| Listing host | 90% of taxable (nights + cleaning) |
| Guest service fee | 5% of taxable |
| Host fee pool | 10% of taxable |
| Upstream referrers (display) | 2% / 2% / 1% of taxable at levels 1–3 |
| Upstream referrers (net payout) | 1% / 1% / 0.5% after StayLoop partner share |
| StayLoop partner share | 50% of each nominal upstream slice stays on platform |
| No upstream referrers | StayLoop keeps full 10% host pool + 5% guest fee |

Example on $1,000 taxable with a full 3-level chain: host $900, net referrer payouts $25 (2.5%), StayLoop keeps $75 from the host pool (7.5%) plus the $50 guest fee.

To test referral accrual:

1. Host A shares invite link (`/hosts?ref=CODE`)
2. Host B signs up via link, completes Stripe onboarding
3. Host B lists a property; guest books it
4. Check `referral_earnings`: `commission_percentage` = 2, `commission_amount` = $20 display, `payout_amount` = $10 net

Referrers need Stripe Connect for **paid** transfers; otherwise earnings stay `pending`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Checkout says payments not configured | Add `VITE_STRIPE_PUBLISHABLE_KEY` on Vercel, redeploy |
| API 401 on checkout | Guest must be signed in |
| Booking stays `pending` after payment | Check webhook secret + Stripe webhook delivery logs |
| Reserve blocked — host Stripe | Host must finish Connect onboarding |
| Wrong commission amounts | Ensure migration `20260704030000_raveshare_partner_split.sql` is applied |
| `--stripe` referral transfers stay `pending` | The `protect_profile_privileged_columns` trigger reverts `stripe_*` writes for non-admin roles; `test-revshare.mjs` seeds fixture Stripe state with `session_replication_role = replica`, so run it with a DB role allowed to set that (Supabase `postgres`) |
| Login fails with `Legacy API keys are disabled` | Use the project's **publishable** key (`sb_publishable_…`) for `VITE_SUPABASE_ANON_KEY`, not the legacy JWT `anon` key |

## Key files

| Area | Path |
|------|------|
| Fee engine | `server/fees.js`, `src/lib/fees.ts` |
| Rev-share payouts | `server/revShare.js` |
| Vercel API routes | `api/` |
| Webhook handler | `api/stripe/webhook.js`, `server/handlers/webhook.js` |
| Test runner | `scripts/test-revshare.mjs` |
