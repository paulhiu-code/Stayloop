/**
 * Client mirror of server/fees.js — keep rates in sync.
 */

export const GUEST_FEE_RATE = 0.05;
export const HOST_FEE_RATE = 0.1;
export const REFERRAL_PARTNER_SHARE = 0.5;

/** Nominal rates shown on referrer dashboards (of taxable). */
export const REFERRAL_DISPLAY_RATES = [0.02, 0.02, 0.01] as const;

/** Net rates actually paid out to referrers (of taxable). */
export const REFERRAL_PAYOUT_RATES = REFERRAL_DISPLAY_RATES.map(
  (rate) => rate * REFERRAL_PARTNER_SHARE
);

export const REFERRAL_LEVEL_LABELS = [
  { level: 1, displayRate: '2%', payoutRate: '1%' },
  { level: 2, displayRate: '2%', payoutRate: '1%' },
  { level: 3, displayRate: '1%', payoutRate: '0.5%' },
] as const;
