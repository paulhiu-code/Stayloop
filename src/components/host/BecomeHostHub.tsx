import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  CreditCard,
  Home,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getHostListings } from '../../lib/listing';
import type { Property } from '../../lib/supabase';
import Header, { type SitePage } from '../Header';

type BecomeHostHubProps = {
  onExit: () => void;
  onNavigate: (page: SitePage) => void;
  onCreateListing: () => void;
  onEditListing: (listingId: string) => void;
  onSetupPayouts: () => void;
  onViewDashboard: () => void;
};

type ChecklistStep = {
  number: number;
  title: string;
  subtitle: string;
  done: boolean;
  icon: typeof Home;
};

export default function BecomeHostHub({
  onExit,
  onNavigate,
  onCreateListing,
  onEditListing,
  onSetupPayouts,
  onViewDashboard,
}: BecomeHostHubProps) {
  const { profile } = useAuth();
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const data = await getHostListings();
        if (!cancelled) {
          setListings(data);
        }
      } catch (err) {
        if (!cancelled) {
          setListings([]);
          setLoadError(err instanceof Error ? err.message : 'Unable to load your listings.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasListings = listings.length > 0;
  const payoutsDone = Boolean(profile?.stripe_payouts_enabled || profile?.stripe_onboarding_complete);
  const hasLiveListing = listings.some((listing) => listing.is_active);
  const firstDraft = listings.find((listing) => !listing.is_active);

  const completedSteps = useMemo(() => {
    let count = 1;
    if (hasListings) count += 1;
    if (payoutsDone) count += 1;
    if (hasLiveListing) count += 1;
    return count;
  }, [hasListings, payoutsDone, hasLiveListing]);

  const progressPercent = (completedSteps / 4) * 100;

  const steps: ChecklistStep[] = [
    {
      number: 1,
      title: 'Create your account',
      subtitle: profile?.full_name ? `Signed in as ${profile.full_name}` : 'Your StayLoop account is ready',
      done: true,
      icon: User,
    },
    {
      number: 2,
      title: 'Create your first listing',
      subtitle: hasListings
        ? `${listings.length} listing${listings.length === 1 ? '' : 's'} in progress`
        : 'Add photos, details, and pricing for your place',
      done: hasListings,
      icon: Home,
    },
    {
      number: 3,
      title: 'Set up payouts',
      subtitle: payoutsDone
        ? 'Payouts enabled — you can receive earnings'
        : 'Connect Stripe so guests can pay you securely',
      done: payoutsDone,
      icon: CreditCard,
    },
    {
      number: 4,
      title: 'Publish & go live',
      subtitle: hasLiveListing
        ? 'At least one listing is live and accepting bookings'
        : 'Complete your listing and enable payouts to start hosting',
      done: hasLiveListing,
      icon: Rocket,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onShowAuth={() => {}} onShowDashboard={onViewDashboard} onNavigate={onNavigate} showHostLinks />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <button
          type="button"
          onClick={onExit}
          className="mb-6 text-sm font-semibold text-gray-600 transition hover:text-gray-900"
        >
          ← Back to StayLoop
        </button>

        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            <p className="font-semibold text-gray-600">Loading your host journey…</p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-600">Become a host</p>
              <h1 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
                You&apos;re {Math.round(progressPercent)}% of the way to hosting on StayLoop
              </h1>
              <p className="mt-3 max-w-2xl text-gray-600">
                Follow these steps to list your place, get paid, and welcome your first guests.
              </p>

              <div className="mt-6">
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-500">
                  {completedSteps} of 4 steps complete
                </p>
              </div>
            </div>

            {loadError && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                We couldn&apos;t load your listings right now. You can still continue — {loadError}
              </div>
            )}

            <div className="mt-8 space-y-4">
              {steps.map((step) => {
                const StepIcon = step.icon;

                return (
                  <div
                    key={step.number}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition sm:p-6 ${
                      step.done ? 'border-green-200' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex gap-4 sm:gap-5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${
                          step.done
                            ? 'bg-green-50 text-green-600'
                            : 'bg-orange-50 text-orange-600'
                        }`}
                      >
                        {step.done ? <CheckCircle2 className="h-6 w-6" /> : step.number}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <StepIcon className="h-5 w-5 text-orange-500" />
                              <h2 className="text-lg font-extrabold text-gray-900 sm:text-xl">{step.title}</h2>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 sm:text-base">{step.subtitle}</p>
                          </div>

                          <div className="shrink-0">
                            {step.done ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                                <CheckCircle2 className="h-4 w-4" />
                                Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                                <Circle className="h-3.5 w-3.5" />
                                To do
                              </span>
                            )}
                          </div>
                        </div>

                        {step.number === 2 && !step.done && (
                          <button
                            type="button"
                            onClick={onCreateListing}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02]"
                          >
                            Start your listing
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}

                        {step.number === 2 && step.done && (
                          <button
                            type="button"
                            onClick={onCreateListing}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-50"
                          >
                            <Plus className="h-4 w-4" />
                            Add another listing
                          </button>
                        )}

                        {step.number === 3 && !step.done && (
                          <button
                            type="button"
                            onClick={onSetupPayouts}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02]"
                          >
                            Set up payouts
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}

                        {step.number === 3 && step.done && (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold text-green-700">Payouts enabled</span>
                            <button
                              type="button"
                              onClick={onViewDashboard}
                              className="text-sm font-bold text-orange-600 hover:text-orange-700"
                            >
                              View payout dashboard →
                            </button>
                          </div>
                        )}

                        {step.number === 4 && !step.done && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-600">
                              A listing must be complete <span className="font-semibold">and</span> payouts must be
                              enabled before you can accept bookings.
                            </p>
                            {firstDraft && (
                              <button
                                type="button"
                                onClick={() => onEditListing(firstDraft.id)}
                                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02]"
                              >
                                Finish &amp; publish
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <section className="mt-10">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-extrabold text-gray-900">Your listings</h2>
                {hasListings && (
                  <button
                    type="button"
                    onClick={onCreateListing}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-800 transition hover:bg-white"
                  >
                    <Plus className="h-4 w-4" />
                    New listing
                  </button>
                )}
              </div>

              {!hasListings ? (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                    <Home className="h-8 w-8 text-orange-500" />
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold text-gray-900">No listings yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-gray-600">
                    Create your first listing to share photos, set your nightly rate, and get ready to host.
                  </p>
                  <button
                    type="button"
                    onClick={onCreateListing}
                    className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-8 py-4 text-base font-bold text-white shadow-xl transition hover:scale-[1.02]"
                  >
                    Create your first listing
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {listings.map((property) => (
                    <ListingRow key={property.id} property={property} onEdit={() => onEditListing(property.id)} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function ListingRow({ property, onEdit }: { property: Property; onEdit: () => void }) {
  const coverImage = property.images[0];
  const location = [property.city, property.state].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:p-5">
      <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 sm:h-24 sm:w-36">
        {coverImage ? (
          <img src={coverImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <Home className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-extrabold text-gray-900">
            {property.title?.trim() || 'Untitled listing'}
          </h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              property.is_active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {property.is_active ? 'Live' : 'Draft'}
          </span>
        </div>
        {location && <p className="mt-1 text-sm text-gray-600">{location}</p>}
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-800 transition hover:bg-gray-50 sm:self-center"
      >
        <Pencil className="h-4 w-4" />
        Edit
      </button>
    </div>
  );
}
