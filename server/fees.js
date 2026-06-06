/**
 * Server mirror of src/lib/fees.ts — keep rates in sync.
 */

export const GUEST_FEE_RATE = 0.05;
export const HOST_FEE_RATE = 0.1;
export const PLATFORM_SHARE_RATE = 0.04;
export const REFERRAL_LEVEL_RATES = [0.03, 0.02, 0.01];

function toCents(amount) {
  return Math.round(amount * 100);
}

export function calculateFeesFromTaxable(subtotal, cleaningFee = 0, referralLevels = 3) {
  const taxable = subtotal + cleaningFee;
  const guestServiceFeeCents = toCents(taxable * GUEST_FEE_RATE);
  const hostServiceFeeCents = toCents(taxable * HOST_FEE_RATE);
  const hostPayoutCents = toCents(taxable * (1 - HOST_FEE_RATE));
  const platformShareCents = toCents(taxable * PLATFORM_SHARE_RATE);

  const activeLevels = Math.min(Math.max(referralLevels, 0), 3);
  const referralLevelCents = [
    activeLevels >= 1 ? toCents(taxable * REFERRAL_LEVEL_RATES[0]) : 0,
    activeLevels >= 2 ? toCents(taxable * REFERRAL_LEVEL_RATES[1]) : 0,
    activeLevels >= 3 ? toCents(taxable * REFERRAL_LEVEL_RATES[2]) : 0,
  ];
  const referralPoolCents = referralLevelCents.reduce((sum, value) => sum + value, 0);
  const totalCents = toCents(taxable) + guestServiceFeeCents;
  const applicationFeeCents = totalCents - hostPayoutCents;

  return {
    subtotalCents: toCents(subtotal),
    cleaningFeeCents: toCents(cleaningFee),
    taxableCents: toCents(taxable),
    guestServiceFeeCents,
    hostServiceFeeCents,
    hostPayoutCents,
    platformShareCents,
    referralLevelCents,
    referralPoolCents,
    totalCents,
    applicationFeeCents,
  };
}

export function centsToDollars(cents) {
  return Number((cents / 100).toFixed(2));
}
