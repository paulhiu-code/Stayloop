import type { Profile } from './supabase';

export type StripeConnectStatus = 'not_started' | 'in_progress' | 'active';

type StripeProfile = Pick<
  Profile,
  'stripe_account_id' | 'stripe_onboarding_complete' | 'stripe_charges_enabled' | 'stripe_payouts_enabled'
>;

export function getStripeConnectStatus(profile: StripeProfile | null | undefined): StripeConnectStatus {
  if (!profile?.stripe_account_id) return 'not_started';
  if (
    profile.stripe_onboarding_complete &&
    profile.stripe_charges_enabled &&
    profile.stripe_payouts_enabled
  ) {
    return 'active';
  }
  return 'in_progress';
}

export function isHostProfile(profile: Pick<Profile, 'user_type'> | null | undefined): boolean {
  return profile?.user_type === 'host' || profile?.user_type === 'both';
}

export const stripeConnectCopy: Record<
  StripeConnectStatus,
  { title: string; description: string; cta: string; badge: string }
> = {
  not_started: {
    title: 'Connect Stripe to receive payouts',
    description:
      'Link a Stripe Express account to accept guest payments on your listings and receive rev-share earnings from your referral network.',
    cta: 'Connect Stripe',
    badge: 'Setup required',
  },
  in_progress: {
    title: 'Finish Stripe verification',
    description:
      'Your Stripe Express account was created but still needs verification before guests can pay you and payouts can flow.',
    cta: 'Complete verification',
    badge: 'Action needed',
  },
  active: {
    title: 'Stripe payouts are active',
    description:
      'Your connected account can accept guest payments and receive host payouts plus upstream rev-share deposits.',
    cta: 'View payout details',
    badge: 'Connected',
  },
};
