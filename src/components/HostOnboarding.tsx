import { useState } from 'react';
import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/api';

type CreateAccountResponse = {
  accountId: string;
};

type OnboardingLinkResponse = {
  url: string;
};

const payoutBenefits = [
  'Bank-level security powered by Stripe',
  'Direct deposit to your bank ~24 hours after guest check-in',
  'You keep 90% of every booking — StayLoop takes a 10% host service fee',
];

export default function HostOnboarding({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSetupPayouts() {
    if (!user) {
      setError('Please sign in before starting host onboarding.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const account = await apiRequest<CreateAccountResponse>('/api/stripe/connect/create-account', {
        method: 'POST',
        body: {},
      });

      const origin = window.location.origin;
      const accountLink = await apiRequest<OnboardingLinkResponse>('/api/stripe/connect/create-onboarding-link', {
        method: 'POST',
        body: {
          accountId: account.accountId,
          returnUrl: `${origin}/host-dashboard?account_id=${account.accountId}`,
          refreshUrl: `${origin}/host-onboarding`,
        },
      });

      window.location.href = accountLink.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Stripe onboarding.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-50 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
        <button
          type="button"
          onClick={onClose}
          className="mb-8 inline-flex items-center gap-2 font-semibold text-gray-600 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to StayLoop
        </button>

        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 shadow-lg shadow-orange-500/25">
            <CreditCard className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-gray-900 sm:text-4xl">Set up payouts with Stripe</h1>
          <p className="mt-4 leading-7 text-gray-600">
            StayLoop uses <span className="font-semibold text-gray-900">Stripe</span> to send your earnings
            securely. You&apos;ll verify your identity and connect a bank account on Stripe&apos;s site — it only
            takes a few minutes. Already use Stripe? You can connect your existing account, or create a new
            one.
          </p>
        </div>

        <ul className="mt-8 space-y-4">
          {payoutBenefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <span className="text-sm font-medium leading-6 text-gray-700 sm:text-base">{benefit}</span>
            </li>
          ))}
        </ul>

        {error && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSetupPayouts()}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-4 text-lg font-bold text-white shadow-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Connecting to Stripe…
            </>
          ) : (
            'Set up payouts with Stripe'
          )}
        </button>

        <p className="mt-4 text-center text-xs text-gray-500">
          You&apos;ll be redirected to Stripe to finish verification. Return here anytime if you need to resume.
        </p>
      </div>
    </div>
  );
}
