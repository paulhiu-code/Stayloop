import { Check, Copy, Link2, Users } from 'lucide-react';
import { useState } from 'react';
import { buildReferralSignupUrl } from '../lib/referral';

type ReferralShareCardProps = {
  referralCode: string;
  directReferrals?: number;
};

export default function ReferralShareCard({ referralCode, directReferrals = 0 }: ReferralShareCardProps) {
  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null);
  const inviteLink = buildReferralSignupUrl(referralCode);

  async function copyValue(value: string, field: 'code' | 'link') {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white">
          <Users className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Refer hosts</p>
          <h3 className="mt-2 text-2xl font-extrabold text-gray-900">Grow your downstream network</h3>
          <p className="mt-2 max-w-2xl leading-7 text-gray-600">
            Share your invite link with other hosts. When they sign up and receive bookings, you earn rev-share
            commissions up to three levels deep on the same Stripe account you use for listing payouts.
          </p>
          {directReferrals > 0 && (
            <p className="mt-3 text-sm font-semibold text-gray-700">
              {directReferrals} direct referral{directReferrals === 1 ? '' : 's'} connected to your account
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Your referral code</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-2xl font-extrabold tracking-wider text-gray-900">{referralCode}</span>
            <button
              onClick={() => void copyValue(referralCode, 'code')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700"
            >
              {copiedField === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedField === 'code' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Invite link for email or SMS</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
              <Link2 className="h-4 w-4 shrink-0 text-orange-500" />
              <span className="truncate">{inviteLink}</span>
            </div>
            <button
              onClick={() => void copyValue(inviteLink, 'link')}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white"
            >
              {copiedField === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedField === 'link' ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
