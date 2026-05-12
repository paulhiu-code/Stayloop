import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  DollarSign,
  Home,
  Link2,
  Shield,
  Smartphone,
  Users,
  Workflow,
} from 'lucide-react';
import Header, { SitePage } from './Header';
import AuthModal from './AuthModal';

type HostsPageProps = {
  onClose: () => void;
  onNavigate: (page: SitePage) => void;
};

const hostFeatures = [
  {
    icon: DollarSign,
    title: 'Keep 90% of booking revenue',
    copy: 'StayLoop takes a 10% host service fee and shows guests a separate 5% guest fee upfront.',
  },
  {
    icon: CalendarCheck,
    title: 'Instant book or request-to-book',
    copy: 'Let proven listings book instantly while premium or high-risk stays can still require approval.',
  },
  {
    icon: Workflow,
    title: 'PMS and calendar sync',
    copy: 'Built around OwnerRez, Guesty, iCal, and multi-property operator workflows from day one.',
  },
  {
    icon: Shield,
    title: 'Protection similar to Airbnb',
    copy: 'Guest screening, damage protection, secure payments, and support workflows are core to the model.',
  },
];

export default function HostsPage({ onClose, onNavigate }: HostsPageProps) {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onShowAuth={() => setShowAuth(true)}
        onShowDashboard={onClose}
        onNavigate={onNavigate}
        showPartnerProgram
      />

      <section className="relative overflow-hidden bg-gradient-to-br from-white via-orange-50 to-rose-50">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-orange-200 blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-rose-200 blur-3xl opacity-50"></div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8 lg:py-32">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-5 py-2.5 text-sm font-bold text-orange-700 shadow-sm">
              <Home className="h-4 w-4" />
              Host marketplace
            </div>
            <h1 className="mt-8 text-5xl font-extrabold leading-tight tracking-tight text-gray-900 lg:text-7xl">
              List your place where guests want to book next.
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-gray-600">
              StayLoop gives hosts a professional listing flow, lower platform economics, verified guests, and property management integrations without making the guest site about referrals.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button
                onClick={() => setShowAuth(true)}
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 px-8 py-4 text-lg font-bold text-white shadow-xl transition hover:scale-105"
              >
                Start listing
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => onNavigate('partners')}
                className="inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-lg font-bold text-gray-900 shadow-xl transition hover:-translate-y-0.5"
              >
                See partner program
                <Link2 className="h-5 w-5 text-orange-600" />
              </button>
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-white p-5 shadow-2xl">
            <img
              src="https://images.pexels.com/photos/5998136/pexels-photo-5998136.jpeg?auto=compress&cs=tinysrgb&w=1400"
              alt="Host preparing a modern short-term rental"
              className="h-96 w-full rounded-[2rem] object-cover"
            />
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                ['10%', 'host fee'],
                ['24h', 'after check-in'],
                ['PMS', 'sync ready'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-2xl font-extrabold text-gray-900">{value}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">Host tools</p>
          <h2 className="mt-4 text-4xl font-extrabold text-gray-900">Everything hosts need before the network effects.</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {hostFeatures.map((feature) => {
            const Icon = feature.icon;

            return (
              <div key={feature.title} className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
                  <Icon className="h-7 w-7 text-orange-600" />
                </div>
                <h3 className="mt-6 text-2xl font-extrabold text-gray-900">{feature.title}</h3>
                <p className="mt-3 leading-7 text-gray-600">{feature.copy}</p>
              </div>
            );
          })}
        </div>

        <section className="mt-20 grid gap-8 rounded-[2.5rem] bg-gray-900 p-8 text-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-300">Operator ready</p>
            <h2 className="mt-4 text-4xl font-extrabold">Built for single homes, hotels, and portfolio managers.</h2>
            <p className="mt-5 leading-8 text-gray-300">
              Hosts can list an entire home, boutique hotel room, cabin, or unique stay, then connect PMS data as they scale.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['OwnerRez and Guesty', 'Import listings, rates, reservations, and availability.'],
              ['Verified property flow', 'ID, ownership or management rights, photos, amenities, and house rules.'],
              ['Guest messaging', 'Pre-arrival chat, instructions, and support escalation.'],
              ['Mobile dashboard', 'Bookings, payouts, sync status, and referral tracking in one place.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/10 p-6">
                <BadgeCheck className="h-6 w-6 text-orange-300" />
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-300">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[2.5rem] border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-8 shadow-xl lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-orange-700 shadow">
                <Users className="h-4 w-4" />
                Optional host growth program
              </div>
              <h2 className="mt-5 text-4xl font-extrabold text-gray-900">Revenue share lives on a separate partner page.</h2>
              <p className="mt-4 max-w-3xl leading-8 text-gray-600">
                Guests see a clean travel marketplace. Qualified hosts can still learn about the 3-2-1 partner structure in a dedicated program experience.
              </p>
            </div>
            <button
              onClick={() => onNavigate('partners')}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gray-900 px-8 py-4 text-lg font-bold text-white shadow-xl"
            >
              Open partner page
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 py-12 text-center text-white">
        <button onClick={onClose} className="mb-5 font-bold text-orange-300 hover:text-orange-200">
          Back to main site
        </button>
        <p className="text-gray-400">© 2026 StayLoop. All rights reserved.</p>
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-gray-500">
          <Smartphone className="h-4 w-4" />
          Web and mobile app experience
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
