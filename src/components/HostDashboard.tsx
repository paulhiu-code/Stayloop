import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, CreditCard, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/api';
import type { SitePage } from './Header';

type AccountStatus = {
  accountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    disabled_reason?: string | null;
  };
};

type OnboardingLinkResponse = {
  url: string;
};

type HostDashboardProps = {
  onClose: () => void;
  onNavigate?: (page: SitePage) => void;
};

export default function HostDashboard({ onClose, onNavigate }: HostDashboardProps) {
  const { profile, refreshProfile } = useAuth();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const accountId =
    new URLSearchParams(window.location.search).get('account_id') ||
    profile?.stripe_account_id ||
    '';

  function goToOnboarding() {
    if (onNavigate) {
      onNavigate('host-onboarding');
      return;
    }
    window.location.href = '/host-onboarding';
  }

  async function loadStatus() {
    if (!accountId) {
      setStatus(null);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const nextStatus = await apiRequest<AccountStatus>(
        `/api/stripe/connect/account-status?accountId=${encodeURIComponent(accountId)}`
      );
      setStatus(nextStatus);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Stripe account status.');
    } finally {
      setLoading(false);
    }
  }

  async function completeVerification() {
    if (!accountId) {
      goToOnboarding();
      return;
    }

    try {
      const origin = window.location.origin;
      const accountLink = await apiRequest<OnboardingLinkResponse>('/api/stripe/connect/create-onboarding-link', {
        method: 'POST',
        body: {
          accountId,
          returnUrl: `${origin}/host-dashboard?account_id=${accountId}`,
          refreshUrl: `${origin}/host-onboarding`,
        },
      });

      window.location.href = accountLink.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reopen Stripe onboarding.');
    }
  }

  useEffect(() => {
    void loadStatus();
  }, [accountId]);

  if (!accountId && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={onClose}
            className="mb-8 inline-flex items-center gap-2 font-semibold text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to StayLoop
          </button>

          <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 text-white">
              <CreditCard className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-extrabold text-gray-900">Connect Stripe to receive payouts</h1>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-gray-600">
              You have not linked a Stripe Express account yet. Connect once to accept guest payments on your
              listings and receive rev-share earnings from hosts in your network.
            </p>
            <button
              onClick={goToOnboarding}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-8 py-4 font-bold text-white shadow-lg"
            >
              Connect Stripe
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={onClose}
          className="mb-8 inline-flex items-center gap-2 font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to StayLoop
        </button>

        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-600">Host payouts</p>
              <h1 className="mt-3 text-4xl font-extrabold text-gray-900">Stripe Express status</h1>
              <p className="mt-3 text-gray-600">
                Confirm whether your host account can accept charges and receive payouts.
              </p>
            </div>
            <button
              onClick={loadStatus}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-5 py-3 font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>

          {error && <div className="mt-8 rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</div>}

          {loading && !status && (
            <div className="mt-8 flex items-center justify-center gap-3 py-12 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Stripe account status...
            </div>
          )}

          {status && (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ['Details submitted', status.detailsSubmitted],
                ['Charges enabled', status.chargesEnabled],
                ['Payouts enabled', status.payoutsEnabled],
              ].map(([label, ok]) => (
                <div key={String(label)} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  {ok ? <CheckCircle className="h-7 w-7 text-green-500" /> : <XCircle className="h-7 w-7 text-orange-500" />}
                  <div className="mt-4 font-bold text-gray-900">{label}</div>
                  <div className="mt-1 text-sm text-gray-500">{ok ? 'Ready' : 'Needs attention'}</div>
                </div>
              ))}
            </div>
          )}

          {status && !status.onboardingComplete && (
            <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-6">
              <h2 className="text-xl font-extrabold text-gray-900">Complete verification</h2>
              <p className="mt-2 leading-7 text-gray-600">
                Stripe still needs information before your account can fully accept charges and receive payouts.
              </p>
              <button
                onClick={completeVerification}
                className="mt-5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3 font-bold text-white shadow-lg"
              >
                Complete Verification
              </button>
            </div>
          )}

          {status?.onboardingComplete && (
            <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6">
              <h2 className="text-xl font-extrabold text-green-900">Payouts are active</h2>
              <p className="mt-2 leading-7 text-green-800">
                Your Stripe Express account is connected. Guests can pay for your listings and you can receive host
                payouts plus rev-share deposits on the same account.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
