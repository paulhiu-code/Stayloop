/**
 * Fee engine — single source of truth for booking splits.
 *
 * RaveShare partner model:
 * - Referrers see nominal rates (2% / 2% / 1% of taxable).
 * - StayLoop keeps 50% of each nominal slice as platform partner share.
 * - Stripe transfers use the net payout rates (1% / 1% / 0.5%).
 * - With no upstream referrers, the host still receives 90% and StayLoop keeps the rest.
 */

export const GUEST_FEE_RATE = 0.05;
export const HOST_FEE_RATE = 0.1;
export const REFERRAL_PARTNER_SHARE = 0.5;

/** Nominal rates shown on referrer dashboards (of taxable). */
export const REFERRAL_DISPLAY_RATES = [0.02, 0.02, 0.01];

/** Net rates actually transferred to referrers (of taxable). */
export const REFERRAL_PAYOUT_RATES = REFERRAL_DISPLAY_RATES.map(
  (rate) => rate * REFERRAL_PARTNER_SHARE
);

/** @deprecated Use REFERRAL_DISPLAY_RATES — kept for older imports. */
export const REFERRAL_LEVEL_RATES = REFERRAL_DISPLAY_RATES;

function toCents(amount) {
  return Math.round(amount * 100);
}

export function calculateFeesFromTaxable(subtotal, cleaningFee = 0, referralLevels = 3) {
  const taxable = subtotal + cleaningFee;
  const guestServiceFeeCents = toCents(taxable * GUEST_FEE_RATE);
  const hostServiceFeeCents = toCents(taxable * HOST_FEE_RATE);
  const hostPayoutCents = toCents(taxable * (1 - HOST_FEE_RATE));
  const totalCents = toCents(taxable) + guestServiceFeeCents;
  const applicationFeeCents = totalCents - hostPayoutCents;

  const activeLevels = Math.min(Math.max(referralLevels, 0), 3);
  const referralDisplayCents = [
    activeLevels >= 1 ? toCents(taxable * REFERRAL_DISPLAY_RATES[0]) : 0,
    activeLevels >= 2 ? toCents(taxable * REFERRAL_DISPLAY_RATES[1]) : 0,
    activeLevels >= 3 ? toCents(taxable * REFERRAL_DISPLAY_RATES[2]) : 0,
  ];
  const referralPayoutCents = [
    activeLevels >= 1 ? toCents(taxable * REFERRAL_PAYOUT_RATES[0]) : 0,
    activeLevels >= 2 ? toCents(taxable * REFERRAL_PAYOUT_RATES[1]) : 0,
    activeLevels >= 3 ? toCents(taxable * REFERRAL_PAYOUT_RATES[2]) : 0,
  ];
  const referralDisplayPoolCents = referralDisplayCents.reduce((sum, value) => sum + value, 0);
  const referralPayoutPoolCents = referralPayoutCents.reduce((sum, value) => sum + value, 0);
  const platformPartnerShareCents = referralDisplayPoolCents - referralPayoutPoolCents;
  const platformHostPoolKeepCents = hostServiceFeeCents - referralPayoutPoolCents;

  return {
    subtotalCents: toCents(subtotal),
    cleaningFeeCents: toCents(cleaningFee),
    taxableCents: toCents(taxable),
    guestServiceFeeCents,
    hostServiceFeeCents,
    hostPayoutCents,
    referralDisplayCents,
    referralPayoutCents,
    referralDisplayPoolCents,
    referralPayoutPoolCents,
    platformPartnerShareCents,
    platformHostPoolKeepCents,
    /** @deprecated Use referralDisplayCents */
    referralLevelCents: referralDisplayCents,
    /** @deprecated Use referralDisplayPoolCents */
    referralPoolCents: referralDisplayPoolCents,
    totalCents,
    applicationFeeCents,
  };
}

export function centsToDollars(cents) {
  return Number((cents / 100).toFixed(2));
}
