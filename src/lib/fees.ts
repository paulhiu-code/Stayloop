/**
 * Single source of truth for StayLoop booking fee + rev-share splits.
 * All percentages are of taxable base (nightly subtotal + cleaning fee).
 *
 * Host service fee pool (10% of taxable):
 *   Level 1 upstream: 3%
 *   Level 2 upstream: 2%
 *   Level 3 upstream: 1%
 *   StayLoop platform: 4% (from host fee pool; guest fee is separate)
 */

export const GUEST_FEE_RATE = 0.05;
export const HOST_FEE_RATE = 0.1;
export const PLATFORM_SHARE_RATE = 0.04;

export const REFERRAL_LEVEL_RATES = [0.03, 0.02, 0.01] as const;

export type FeeBreakdown = {
  subtotalCents: number;
  cleaningFeeCents: number;
  taxableCents: number;
  guestServiceFeeCents: number;
  hostServiceFeeCents: number;
  hostPayoutCents: number;
  platformShareCents: number;
  referralLevelCents: [number, number, number];
  referralPoolCents: number;
  totalCents: number;
  applicationFeeCents: number;
};

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function calculateFeesFromTaxable(
  subtotal: number,
  cleaningFee = 0,
  referralLevels = 3
): FeeBreakdown {
  const taxable = subtotal + cleaningFee;
  const guestServiceFeeCents = toCents(taxable * GUEST_FEE_RATE);
  const hostServiceFeeCents = toCents(taxable * HOST_FEE_RATE);
  const hostPayoutCents = toCents(taxable * (1 - HOST_FEE_RATE));
  const platformShareCents = toCents(taxable * PLATFORM_SHARE_RATE);

  const activeLevels = Math.min(Math.max(referralLevels, 0), 3);
  const referralLevelCents: [number, number, number] = [
    activeLevels >= 1 ? toCents(taxable * REFERRAL_LEVEL_RATES[0]) : 0,
    activeLevels >= 2 ? toCents(taxable * REFERRAL_LEVEL_RATES[1]) : 0,
    activeLevels >= 3 ? toCents(taxable * REFERRAL_LEVEL_RATES[2]) : 0,
  ];
  const referralPoolCents = referralLevelCents[0] + referralLevelCents[1] + referralLevelCents[2];
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

export function centsToDollars(cents: number): number {
  return Number((cents / 100).toFixed(2));
}
