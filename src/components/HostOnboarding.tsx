import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/api';

type CreateAccountResponse = {
  accountId: string;
};

type OnboardingLinkResponse = {
  url: string;
};

export default function HostOnboarding({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    async function startOnboarding() {
      if (!user) {
        setError('Please sign in before starting host onboarding.');
        return;
      }

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
      }
    }

    startOnboarding();
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-50 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-2xl">
        <button onClick={onClose} className="mb-8 inline-flex items-center gap-2 font-semibold text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to StayLoop
        </button>

        {error ? (
          <>
            <h1 className="text-3xl font-extrabold text-gray-900">Stripe onboarding needs attention</h1>
            <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-orange-500" />
            <h1 className="mt-6 text-3xl font-extrabold text-gray-900">Preparing your host payout setup</h1>
            <p className="mt-4 leading-7 text-gray-600">
              We are creating your Stripe Express account and redirecting you to Stripe to finish verification.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
