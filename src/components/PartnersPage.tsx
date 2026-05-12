import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CircleDollarSign,
  FileCheck2,
  Link2,
  Network,
  ShieldCheck,
  Split,
  Users,
} from 'lucide-react';
import Header, { SitePage } from './Header';
import AuthModal from './AuthModal';

type PartnersPageProps = {
  onClose: () => void;
  onNavigate: (page: SitePage) => void;
  onShowAuth: () => void;
};

const splitRows = [
  ['Level 1', '3%', 'Direct referral', 'Highest reward for the host who did the acquisition work.'],
  ['Level 2', '2%', 'Their referral', 'Keeps upstream hosts engaged without overpaying passive depth.'],
  ['Level 3', '1%', 'Third level', 'Creates network effects while preserving marketplace margin.'],
];

const rules = [
  {
    icon: BadgeCheck,
    title: 'Qualified referrers',
    copy: 'Only verified hosts with at least one active property can earn partner commissions.',
  },
  {
    icon: Link2,
    title: 'Attribution recommendation',
    copy: 'Use referral links and invite codes with last qualified touch before signup, plus manual admin override for sales-led accounts.',
  },
  {
    icon: Ban,
    title: 'Anti-gaming controls',
    copy: 'Block self-referrals, circular referrals, duplicate tax entities, shell accounts, and related-party abuse before payout.',
  },
  {
    icon: FileCheck2,
    title: 'Payout timing',
    copy: 'Mark earnings pending at booking and release after the host booking payout clears.',
  },
];

export default function PartnersPage({ onClose, onNavigate, onShowAuth }: PartnersPageProps) {
  const [showAuth, setShowAuth] = useState(false);

  function openAuth() {
    onShowAuth();
    setShowAuth(true);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header
        onShowAuth={openAuth}
        onShowDashboard={onClose}
        onNavigate={onNavigate}
        showHostLinks
        showPartnerProgram
      />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.25),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.22),transparent_28%)]"></div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-5 py-2.5 text-sm font-bold text-orange-200">
              <Network className="h-4 w-4" />
              StayLoop Partner Program
            </div>
            <h1 className="mt-8 text-5xl font-extrabold leading-tight tracking-tight lg:text-7xl">
              A separate home for the host referral economy.
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-300">
              The consumer marketplace stays focused on booking. This partner page explains how qualified hosts can refer other hosts and earn from the 10% host service fee.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button
                onClick={openAuth}
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 px-8 py-4 text-lg font-bold text-white shadow-xl transition hover:scale-105"
              >
                Apply as a host partner
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => onNavigate('hosts')}
                className="rounded-2xl border border-white/15 bg-white/10 px-8 py-4 text-lg font-bold text-white"
              >
                Host marketplace
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <section className="rounded-[2.5rem] border border-white/10 bg-white p-6 text-gray-900 shadow-2xl lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">Recommended split</p>
              <h2 className="mt-4 text-4xl font-extrabold">Use a 3-2-1 structure from the 10% host fee.</h2>
              <p className="mt-5 leading-8 text-gray-600">
                This shares 6 percentage points of the host service fee across three levels and leaves 4 points for StayLoop operations, support, insurance, payment costs, and product investment.
              </p>
            </div>
            <div className="space-y-3">
              {splitRows.map(([level, percent, relationship, reason]) => (
                <div key={level} className="grid gap-4 rounded-3xl border border-gray-200 bg-gray-50 p-5 sm:grid-cols-[90px_80px_1fr] sm:items-center">
                  <div className="font-extrabold text-gray-900">{level}</div>
                  <div className="text-4xl font-extrabold text-orange-600">{percent}</div>
                  <div>
                    <div className="font-bold text-gray-900">{relationship}</div>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ['10%', 'host service fee'],
            ['6%', 'paid across levels'],
            ['4%', 'retained by StayLoop'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-xl">
              <div className="text-5xl font-extrabold text-orange-300">{value}</div>
              <div className="mt-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-300">{label}</div>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-300">Program guardrails</p>
            <h2 className="mt-4 text-4xl font-extrabold">Rules that make the model investable.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {rules.map((rule) => {
              const Icon = rule.icon;

              return (
                <div key={rule.title} className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-xl">
                  <Icon className="h-8 w-8 text-orange-300" />
                  <h3 className="mt-5 text-2xl font-extrabold">{rule.title}</h3>
                  <p className="mt-3 leading-7 text-slate-300">{rule.copy}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-16 rounded-[2.5rem] bg-gradient-to-br from-orange-500 via-rose-500 to-orange-600 p-8 shadow-2xl lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Split className="h-10 w-10" />
              <h2 className="mt-5 text-4xl font-extrabold">Why not promote this on the guest homepage?</h2>
              <p className="mt-4 leading-8 text-white/90">
                Guests need trust, search, pricing, and booking clarity. Hosts need economics. Keeping those stories separate makes each page more persuasive.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Guest site', 'Search, listings, dates, fees, reviews, verification, and support.'],
                ['Host site', 'Fees, payouts, PMS integrations, verification, and listing controls.'],
                ['Partner site', 'Referral rules, 3-2-1 split, compliance, and payout status.'],
                ['Admin layer', 'Attribution, KYC, audits, tax reporting, and fraud monitoring.'],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-3xl bg-white/15 p-6">
                  <h3 className="text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/85">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 rounded-[2.5rem] border border-white/10 bg-white/10 p-8 shadow-xl lg:grid-cols-3 lg:p-10">
          {[
            {
              icon: CircleDollarSign,
              title: 'Payment processor',
              copy: 'Use Stripe Connect for guest collection, platform fees, delayed host payouts, tax forms, and split accounting.',
            },
            {
              icon: ShieldCheck,
              title: 'Risk posture',
              copy: 'Replicate Airbnb-like guest protection, require host insurance details, and partner with a damage protection carrier.',
            },
            {
              icon: Users,
              title: 'Go-to-market',
              copy: 'Start with property managers and verified hosts who already use PMS tools and can bring inventory quickly.',
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title}>
                <Icon className="h-8 w-8 text-orange-300" />
                <h3 className="mt-5 text-2xl font-extrabold">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{item.copy}</p>
              </div>
            );
          })}
        </section>
      </main>

      <footer className="border-t border-white/10 py-12 text-center">
        <button onClick={onClose} className="font-bold text-orange-300 hover:text-orange-200">
          Back to guest site
        </button>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
