import { ArrowRight, CheckCircle, CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getStripeConnectStatus,
  stripeConnectCopy,
  type StripeConnectStatus,
} from '../lib/stripeConnect';
import type { SitePage } from './Header';

type StripeConnectCardProps = {
  onNavigate?: (page: SitePage) => void;
  className?: string;
};

export default function StripeConnectCard({ onNavigate, className = '' }: StripeConnectCardProps) {
  const { profile, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const status: StripeConnectStatus = getStripeConnectStatus(profile);
  const copy = stripeConnectCopy[status];

  useEffect(() => {
    void refreshProfile();
  }, []);

  function goTo(page: SitePage) {
    if (onNavigate) {
      onNavigate(page);
      return;
    }
    const paths: Record<string, string> = {
      'host-onboarding': '/host-onboarding',
      'host-dashboard': '/host-dashboard',
    };
    window.location.href = paths[page] || '/';
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  }

  function handlePrimaryAction() {
    if (status === 'active') {
      goTo('host-dashboard');
      return;
    }
    goTo('host-onboarding');
  }

  const containerClass =
    status === 'active'
      ? 'border-green-200 bg-gradient-to-br from-green-50 to-white'
      : status === 'in_progress'
        ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-white'
        : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white';

  const badgeClass =
    status === 'active'
      ? 'bg-green-100 text-green-800'
      : status === 'in_progress'
        ? 'bg-orange-100 text-orange-800'
        : 'bg-slate-200 text-slate-700';

  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${containerClass} ${className}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              status === 'active' ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'
            }`}
          >
            {status === 'active' ? <CheckCircle className="h-7 w-7" /> : <CreditCard className="h-7 w-7" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">Host payouts</p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeClass}`}>{copy.badge}</span>
            </div>
            <h3 className="mt-2 text-2xl font-extrabold text-gray-900">{copy.title}</h3>
            <p className="mt-2 max-w-2xl leading-7 text-gray-600">{copy.description}</p>
            {status === 'active' && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold shadow-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Charges enabled
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold shadow-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Payouts enabled
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <button
            onClick={handlePrimaryAction}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-bold text-white shadow-lg transition ${
              status === 'active'
                ? 'bg-gray-900 hover:bg-gray-800'
                : 'bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600'
            }`}
          >
            {copy.cta}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh status
          </button>
        </div>
      </div>
    </div>
  );
}
