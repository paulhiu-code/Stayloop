import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  DollarSign,
  Home,
  Calendar,
  Settings,
  Copy,
  Check,
  Network,
  ArrowRight,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Property, ReferralEarning } from '../lib/supabase';
import {
  bookingStatusLabel,
  fetchDirectReferralCount,
  fetchGuestBookings,
  fetchHostBookings,
  fetchHostProperties,
  fetchReferralEarnings,
  formatBookingDates,
  propertyCoverImage,
  summarizeGuestBookings,
  summarizeHostBookings,
  type BookingWithProperty,
  type GuestDashboardStats,
  type HostDashboardStats,
} from '../lib/dashboard';
import type { SitePage } from './Header';
import PMSSettings from './PMSSettings';
import MessagesPanel from './MessagesPanel';
import AddPropertyModal from './AddPropertyModal';
import { ensureBookingConversations } from '../lib/messaging';
import {
  buildDashboardPath,
  type DashboardMode,
  type DashboardTab,
} from '../lib/dashboardRoute';

export default function Dashboard({
  onClose,
  onNavigate,
  initialMode,
  initialTab,
  onRouteChange,
}: {
  onClose: () => void;
  onNavigate?: (page: SitePage) => void;
  initialMode?: DashboardMode;
  initialTab?: DashboardTab;
  onRouteChange?: (mode: DashboardMode, tab: DashboardTab) => void;
}) {
  const { profile, updateUserType } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab ?? 'bookings');
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(initialMode ?? 'guest');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [guestBookings, setGuestBookings] = useState<BookingWithProperty[]>([]);
  const [hostBookings, setHostBookings] = useState<BookingWithProperty[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [earnings, setEarnings] = useState<ReferralEarning[]>([]);
  const [guestStats, setGuestStats] = useState<GuestDashboardStats>({
    upcomingTrips: 0,
    pastTrips: 0,
    totalSpent: 0,
  });
  const [hostStats, setHostStats] = useState<HostDashboardStats>({
    totalEarnings: 0,
    pendingEarnings: 0,
    totalReferrals: 0,
    activeProperties: 0,
    totalBookings: 0,
    upcomingBookings: 0,
  });

  const canHost = profile?.user_type === 'host' || profile?.user_type === 'both';

  useEffect(() => {
    if (!profile) return;
    if (!initialMode) {
      setDashboardMode(profile.user_type === 'guest' ? 'guest' : 'host');
    }
  }, [profile?.id, profile?.user_type, initialMode]);

  useEffect(() => {
    if (initialMode) setDashboardMode(initialMode);
    if (initialTab) setActiveTab(initialTab);
  }, [initialMode, initialTab]);

  function updateDashboardRoute(mode: DashboardMode, tab: DashboardTab) {
    onRouteChange?.(mode, tab);
    if (!onRouteChange) {
      window.history.replaceState({}, '', buildDashboardPath(mode, tab));
    }
  }

  function switchMode(mode: DashboardMode) {
    const nextTab = mode === 'host' ? 'overview' : 'bookings';
    setDashboardMode(mode);
    setActiveTab(nextTab);
    updateDashboardRoute(mode, nextTab);
  }

  function switchTab(tab: DashboardTab) {
    setActiveTab(tab);
    updateDashboardRoute(dashboardMode, tab);
  }

  useEffect(() => {
    if (!profile) return;
    void loadDashboardData();
  }, [profile?.id, dashboardMode]);

  async function loadDashboardData() {
    if (!profile) return;

    setLoading(true);
    setLoadError('');

    try {
      if (dashboardMode === 'guest') {
        const bookings = await fetchGuestBookings(profile.id);
        setGuestBookings(bookings);
        setGuestStats(summarizeGuestBookings(bookings));
      } else {
        const [bookings, hostProperties, hostEarnings, referralCount] = await Promise.all([
          fetchHostBookings(profile.id),
          fetchHostProperties(profile.id),
          fetchReferralEarnings(profile.id),
          fetchDirectReferralCount(profile.id),
        ]);

        setHostBookings(bookings);
        setProperties(hostProperties);
        setEarnings(hostEarnings);
        setHostStats(summarizeHostBookings(bookings, hostEarnings, hostProperties, referralCount));
      }
    } catch (error) {
      console.error('Dashboard load failed:', error);
      setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  const recentActivity = useMemo(() => {
    const source = dashboardMode === 'guest' ? guestBookings : hostBookings;
    return source.slice(0, 5);
  }, [dashboardMode, guestBookings, hostBookings]);

  function copyReferralCode() {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function becomeHost() {
    await updateUserType('both');
    setDashboardMode('host');
    setActiveTab('overview');
  }

  function openStripeDashboard() {
    if (onNavigate) {
      onClose();
      onNavigate('host-dashboard');
      return;
    }
    window.location.href = '/host-dashboard';
  }

  function openHostOnboarding() {
    if (onNavigate) {
      onClose();
      onNavigate('host-onboarding');
      return;
    }
    window.location.href = '/host-onboarding';
  }

  const hostTabConfig: Array<{ id: DashboardTab; label: string; icon: typeof TrendingUp }> = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'referrals', label: 'Referrals', icon: Network },
    { id: 'pms', label: 'PMS Integrations', icon: Settings },
  ];

  const guestTabConfig: Array<{ id: DashboardTab; label: string; icon: typeof Calendar }> = [
    { id: 'bookings', label: 'Trips', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  async function ensureConversationsForCurrentBookings() {
    const bookings = dashboardMode === 'guest' ? guestBookings : hostBookings;
    await ensureBookingConversations(bookings);
  }

  function renderBookingCard(booking: BookingWithProperty, perspective: 'guest' | 'host') {
    const title = booking.property?.title || 'Property';
    const location = booking.property
      ? `${booking.property.city}, ${booking.property.state}`
      : null;
    const cover = propertyCoverImage(booking.property?.images);

    return (
      <div
        key={booking.id}
        className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 transition hover:border-orange-200 sm:flex-row sm:items-center"
      >
        {cover ? (
          <img src={cover} alt={title} className="h-20 w-28 rounded-lg object-cover" />
        ) : (
          <div className="flex h-20 w-28 items-center justify-center rounded-lg bg-gray-100">
            <Home className="h-6 w-6 text-gray-400" />
          </div>
        )}
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{title}</div>
          {location && (
            <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </div>
          )}
          <div className="mt-2 text-sm text-gray-600">{formatBookingDates(booking.check_in, booking.check_out)}</div>
          <div className="mt-1 text-sm capitalize text-gray-500">{bookingStatusLabel(booking.status)}</div>
          {perspective === 'host' && (booking.guest_name || booking.guest_email) && (
            <div className="mt-1 text-sm text-gray-500">
              Guest: {booking.guest_name || booking.guest_email}
            </div>
          )}
          {booking.booking_source && booking.booking_source !== 'stayloop' && (
            <div className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              via {booking.booking_source}
            </div>
          )}
        </div>
        <div className="text-left sm:text-right">
          <div className="text-lg font-bold text-gray-900">${Number(booking.total_amount).toFixed(2)}</div>
          {perspective === 'host' ? (
            <div className="text-sm text-green-600">Payout ${Number(booking.host_payout).toFixed(2)}</div>
          ) : (
            <div className="text-sm text-gray-500">{booking.num_guests} guest{booking.num_guests === 1 ? '' : 's'}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-gray-50">
      <div className="min-h-screen">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500">
                <Home className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-xs text-gray-500">Welcome back, {profile?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {canHost && (
                <div className="flex rounded-full border border-gray-200 bg-gray-50 p-1">
                  <button
                    onClick={() => switchMode('guest')}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      dashboardMode === 'guest'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Guest
                  </button>
                  <button
                    onClick={() => switchMode('host')}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      dashboardMode === 'host'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Host
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2.5 font-medium text-gray-700 transition hover:text-gray-900"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {loadError && (
            <div className="mb-6 rounded-2xl bg-rose-50 p-4 text-rose-700">{loadError}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading dashboard...
            </div>
          ) : dashboardMode === 'guest' ? (
            <div className="space-y-8">
              <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl">
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-orange-300">Guest mode</p>
                <h2 className="text-4xl font-extrabold tracking-tight">Your trips and reservations</h2>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
                  Bookings you complete on StayLoop appear here with property details, dates, and status.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="text-3xl font-bold text-gray-900">{guestStats.upcomingTrips}</div>
                  <div className="mt-1 text-sm text-gray-500">Upcoming trips</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="text-3xl font-bold text-gray-900">{guestStats.pastTrips}</div>
                  <div className="mt-1 text-sm text-gray-500">Past trips</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="text-3xl font-bold text-gray-900">${guestStats.totalSpent.toFixed(2)}</div>
                  <div className="mt-1 text-sm text-gray-500">Total spent on StayLoop</div>
                </div>
              </div>

              <div className="flex gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
                {guestTabConfig.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => switchTab(tab.id)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                        activeTab === tab.id
                          ? 'bg-orange-50 text-orange-600'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'messages' ? (
                <MessagesPanel
                  userId={profile!.id}
                  bookings={guestBookings}
                  onEnsureConversations={ensureConversationsForCurrentBookings}
                />
              ) : (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900">Your bookings</h3>
                {guestBookings.length === 0 ? (
                  <div className="py-12 text-center">
                    <Calendar className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                    <p className="text-gray-500">No StayLoop bookings yet.</p>
                    <p className="mt-2 text-sm text-gray-400">
                      When you book a property on StayLoop, it will show up here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {guestBookings.map((booking) => renderBookingCard(booking, 'guest'))}
                  </div>
                )}
              </div>
              )}

              {!canHost && (
                <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-8 shadow-sm">
                  <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-600">
                        Have a place to list?
                      </p>
                      <h3 className="mt-3 text-3xl font-extrabold text-gray-900">Become a host on StayLoop</h3>
                      <p className="mt-3 max-w-2xl leading-7 text-gray-600">
                        Unlock host tools, PMS integrations, property listings, and booking management while keeping guest access.
                      </p>
                    </div>
                    <button
                      onClick={becomeHost}
                      className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-7 py-4 font-bold text-white shadow-lg transition hover:shadow-xl"
                    >
                      Become a host
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-8 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 p-8 text-white shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="mb-2 text-2xl font-bold">Your Referral Code</h2>
                    <p className="text-white/90">Share this code and earn passive income</p>
                  </div>
                  <Users className="h-12 w-12 text-white/80" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 rounded-xl bg-white/20 px-6 py-4 backdrop-blur-sm">
                    <span className="text-3xl font-bold tracking-wider">{profile?.referral_code}</span>
                  </div>
                  <button
                    onClick={copyReferralCode}
                    className="flex items-center gap-2 rounded-xl bg-white px-6 py-4 font-semibold text-orange-600 shadow-lg transition-all hover:bg-orange-50"
                  >
                    {copied ? (
                      <>
                        <Check className="h-5 w-5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-5 w-5" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="mb-1 text-3xl font-bold text-gray-900">${hostStats.totalEarnings.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Total earnings</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="mb-1 text-3xl font-bold text-gray-900">${hostStats.pendingEarnings.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Pending earnings</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="mb-1 text-3xl font-bold text-gray-900">{hostStats.totalReferrals}</div>
                  <div className="text-sm text-gray-500">Direct referrals</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                    <Home className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="mb-1 text-3xl font-bold text-gray-900">{hostStats.activeProperties}</div>
                  <div className="text-sm text-gray-500">Active properties</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100">
                    <Calendar className="h-6 w-6 text-rose-600" />
                  </div>
                  <div className="mb-1 text-3xl font-bold text-gray-900">{hostStats.totalBookings}</div>
                  <div className="text-sm text-gray-500">Reservations</div>
                </div>
              </div>

              <div className="mb-8 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Stripe payouts</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        Connect and verify Stripe Express to accept guest payments on StayLoop bookings.
                      </p>
                    </div>
                    <CreditCard className="h-8 w-8 text-orange-500" />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={openStripeDashboard}
                      className="rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3 font-bold text-white shadow-md"
                    >
                      View payout status
                    </button>
                    {!profile?.stripe_onboarding_complete && (
                      <button
                        onClick={openHostOnboarding}
                        className="rounded-xl border border-gray-200 px-5 py-3 font-bold text-gray-700"
                      >
                        Set up Stripe
                      </button>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900">Operations snapshot</h3>
                  <div className="mt-4 space-y-3 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Upcoming reservations</span>
                      <span className="font-bold text-gray-900">{hostStats.upcomingBookings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Properties synced via PMS</span>
                      <span className="font-bold text-gray-900">
                        {properties.filter((p) => p.pms_integration).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stripe charges enabled</span>
                      <span className="font-bold text-gray-900">
                        {profile?.stripe_charges_enabled ? 'Yes' : 'Not yet'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-100">
                  <div className="flex gap-4 overflow-x-auto px-6">
                    {hostTabConfig.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => switchTab(tab.id)}
                          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-4 font-medium transition ${
                            activeTab === tab.id
                              ? 'border-orange-500 text-orange-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === 'overview' && (
                    <div>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">Recent reservations</h3>
                      {recentActivity.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">No reservations yet</div>
                      ) : (
                        <div className="space-y-4">
                          {recentActivity.map((booking) => renderBookingCard(booking, 'host'))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'properties' && (
                    <div>
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Your properties</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Properties imported from OwnerRez or Guesty sync automatically through PMS Integrations.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowAddProperty(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-2.5 font-semibold text-white shadow-md"
                        >
                          <Plus className="h-4 w-4" />
                          Add property
                        </button>
                      </div>
                      {properties.length === 0 ? (
                        <div className="py-12 text-center">
                          <Home className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                          <p className="text-gray-500">No properties listed yet</p>
                          <button
                            onClick={() => setActiveTab('pms')}
                            className="mt-4 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3 font-semibold text-white shadow-md"
                          >
                            Connect a PMS to import listings
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {properties.map((property) => (
                            <div
                              key={property.id}
                              className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 transition hover:border-orange-200"
                            >
                              <div className="h-24 w-24 overflow-hidden rounded-lg bg-gray-100">
                                {propertyCoverImage(property.images) ? (
                                  <img
                                    src={propertyCoverImage(property.images)}
                                    alt={property.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Home className="h-6 w-6 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{property.title}</h4>
                                <p className="text-sm text-gray-500">
                                  {property.city}, {property.state}
                                </p>
                                {property.pms_integration && (
                                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-orange-600">
                                    Synced via PMS
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">${property.base_price}/night</div>
                                <div className="text-sm text-gray-500">
                                  {property.is_active ? 'Active' : 'Inactive'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'bookings' && (
                    <div>
                      <h3 className="mb-6 text-lg font-bold text-gray-900">Your reservations</h3>
                      {hostBookings.length === 0 ? (
                        <div className="py-12 text-center">
                          <Calendar className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                          <p className="text-gray-500">No bookings yet</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {hostBookings.map((booking) => renderBookingCard(booking, 'host'))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'referrals' && (
                    <div>
                      <h3 className="mb-4 text-lg font-bold text-gray-900">Referral network</h3>
                      <div className="mb-6 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 p-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm font-medium text-gray-700">Level 1 (Direct)</span>
                            <span className="font-bold text-orange-600">3%</span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm font-medium text-gray-700">Level 2</span>
                            <span className="font-bold text-orange-600">2%</span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm font-medium text-gray-700">Level 3</span>
                            <span className="font-bold text-orange-600">1%</span>
                          </div>
                        </div>
                      </div>

                      {earnings.length === 0 ? (
                        <div className="py-12 text-center">
                          <Network className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                          <p className="mb-2 text-gray-500">No referral earnings yet</p>
                          <p className="text-sm text-gray-400">Share your code to start earning</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {earnings.map((earning) => (
                            <div
                              key={earning.id}
                              className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
                            >
                              <div>
                                <div className="font-medium text-gray-900">
                                  Level {earning.referral_level} commission
                                </div>
                                <div className="text-sm text-gray-500">
                                  {earning.commission_percentage}% · {earning.status}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-600">
                                  +${earning.commission_amount}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(earning.booking_date).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'messages' && profile && (
                    <MessagesPanel
                      userId={profile.id}
                      bookings={hostBookings}
                      onEnsureConversations={ensureConversationsForCurrentBookings}
                    />
                  )}

                  {activeTab === 'pms' && <PMSSettings />}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {showAddProperty && profile && (
        <AddPropertyModal
          hostId={profile.id}
          onClose={() => setShowAddProperty(false)}
          onCreated={() => void loadDashboardData()}
        />
      )}
    </div>
  );
}
