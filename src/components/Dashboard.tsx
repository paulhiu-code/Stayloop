import { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Home,
  Calendar,
  Settings,
  Copy,
  Check,
  Network,
  ArrowRight,
  Mail,
  CalendarCheck,
  MapPin,
  Sparkles,
  Wallet,
  Heart,
  MessageSquare,
  Plane,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ReferralEarning, Property, Booking } from '../lib/supabase';
import EmailCmsDashboard from './admin/EmailCmsDashboard';
import PMSSettings from './PMSSettings';

type DashboardTab = 'overview' | 'properties' | 'bookings' | 'referrals' | 'pms';
type DashboardMode = 'guest' | 'host';
type AdminView = 'main' | 'email-cms';

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadgeClass(status?: string) {
  const normalized = (status || '').toLowerCase();
  if (['confirmed', 'active', 'succeeded', 'paid', 'completed'].includes(normalized)) {
    return 'bg-success-soft text-success';
  }
  if (['pending', 'processing'].includes(normalized)) {
    return 'bg-amber-50 text-amber-700';
  }
  if (['cancelled', 'canceled', 'failed', 'declined'].includes(normalized)) {
    return 'bg-rose-50 text-rose-700';
  }
  return 'bg-page-muted text-ink-muted';
}

export default function Dashboard({ onClose }: { onClose: () => void }) {
  const { profile, updateUserType, isAdmin } = useAuth();
  const [adminView, setAdminView] = useState<AdminView>('main');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('guest');
  const [copied, setCopied] = useState(false);
  const [earnings, setEarnings] = useState<ReferralEarning[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    pendingEarnings: 0,
    totalReferrals: 0,
    activeProperties: 0,
    totalBookings: 0,
  });

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
      setDashboardMode(profile.user_type === 'guest' ? 'guest' : 'host');
    }
  }, [profile]);

  const canHost = profile?.user_type === 'host' || profile?.user_type === 'both';

  async function fetchDashboardData() {
    if (!profile) return;

    const [earningsRes, propertiesRes, bookingsRes, referralsRes] = await Promise.all([
      supabase.from('referral_earnings').select('*').eq('earner_id', profile.id),
      supabase.from('properties').select('*').eq('host_id', profile.id),
      supabase.from('bookings').select('*').eq('host_id', profile.id),
      supabase.from('profiles').select('id').eq('referred_by', profile.id),
    ]);

    if (earningsRes.data) setEarnings(earningsRes.data);
    if (propertiesRes.data) setProperties(propertiesRes.data);
    if (bookingsRes.data) setBookings(bookingsRes.data);

    const totalEarnings = earningsRes.data?.reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;
    const pendingEarnings = earningsRes.data?.filter((e) => e.status === 'pending').reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;

    setStats({
      totalEarnings,
      pendingEarnings,
      totalReferrals: referralsRes.data?.length || 0,
      activeProperties: propertiesRes.data?.filter((p) => p.is_active).length || 0,
      totalBookings: bookingsRes.data?.length || 0,
    });
  }

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
    setActiveTab('properties');
  }

  const tabs: Array<{ id: DashboardTab; label: string; icon: typeof TrendingUp }> = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'properties', label: 'Listings', icon: Home },
    { id: 'bookings', label: 'Reservations', icon: Calendar },
    { id: 'referrals', label: 'Referrals', icon: Network },
    { id: 'pms', label: 'Integrations', icon: Settings },
  ];

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingBookings = [...bookings]
    .filter((b) => (b.check_in || '') >= todayStr)
    .sort((a, b) => ((a.check_in || '') < (b.check_in || '') ? -1 : 1))
    .slice(0, 5);
  const recentEarnings = [...earnings]
    .sort((a, b) => new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime())
    .slice(0, 5);

  const statCards = [
    { label: 'Total earnings', value: `$${stats.totalEarnings.toFixed(2)}`, icon: DollarSign, tone: 'text-success' },
    { label: 'Pending earnings', value: `$${stats.pendingEarnings.toFixed(2)}`, icon: TrendingUp, tone: 'text-brand' },
    { label: 'Active listings', value: `${stats.activeProperties}`, icon: Home, tone: 'text-ink' },
    { label: 'Reservations', value: `${stats.totalBookings}`, icon: CalendarCheck, tone: 'text-ink' },
  ];

  function ReferralShareCard({ compact = false }: { compact?: boolean }) {
    return (
      <div className="card-surface p-5">
        <div className="flex items-center gap-2 text-ink">
          <Sparkles className="h-4 w-4 text-brand" />
          <span className="text-sm font-semibold">Share &amp; earn</span>
        </div>
        {!compact && (
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Invite hosts with your code and earn commission across three referral levels.
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 truncate rounded-control border border-border bg-page-muted px-4 py-2.5 text-base font-bold tracking-wider text-ink">
            {profile?.referral_code || '—'}
          </code>
          <button type="button" onClick={copyReferralCode} className="btn-secondary !px-3 !py-2.5" aria-label="Copy referral code">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        {!compact && stats.totalReferrals > 0 && (
          <p className="mt-3 text-xs font-medium text-ink-muted">{stats.totalReferrals} direct referral{stats.totalReferrals === 1 ? '' : 's'}</p>
        )}
      </div>
    );
  }

  return (
    <div className="page-shell fixed inset-0 z-50 overflow-auto">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="logo-mark">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-ink">Dashboard</h1>
                <p className="text-xs text-ink-muted">Welcome back, {profile?.full_name || 'there'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {canHost && (
                <div className="flex rounded-pill border border-border bg-page-muted p-1">
                  {(['guest', 'host'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDashboardMode(mode)}
                      className={`rounded-pill px-4 py-1.5 text-sm font-semibold capitalize transition ${
                        dashboardMode === mode ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={onClose} className="btn-ghost">
                Back to home
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8">
        {isAdmin && (
          <div className="mb-8 flex flex-wrap gap-2 rounded-pill border border-border bg-page-muted p-1">
            <button
              type="button"
              onClick={() => setAdminView('main')}
              className={`rounded-pill px-4 py-2 text-sm font-semibold transition ${
                adminView === 'main' ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
              }`}
            >
              My dashboard
            </button>
            <button
              type="button"
              onClick={() => setAdminView('email-cms')}
              className={`inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold transition ${
                adminView === 'email-cms' ? 'bg-brand text-brand-foreground shadow-card' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Mail className="h-4 w-4" />
              Email CMS
            </button>
          </div>
        )}

        {adminView === 'email-cms' && isAdmin ? (
          <div className="-mx-4 overflow-hidden rounded-card border border-border sm:mx-0">
            <EmailCmsDashboard embedded onClose={() => setAdminView('main')} />
          </div>
        ) : dashboardMode === 'guest' ? (
          <div className="space-y-8">
            <div>
              <p className="section-label">Guest</p>
              <h2 className="section-title mt-2">Welcome back, {profile?.full_name?.split(' ')[0] || 'traveler'}</h2>
              <p className="section-copy mt-2 max-w-2xl">
                Your trips, saved stays, and messages will live here. Start exploring to plan your next getaway.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: Plane, title: 'Upcoming trips', copy: 'Your reservations and check-in details will appear here once you book.' },
                { icon: Heart, title: 'Saved stays', copy: 'Shortlist homes, cabins, and city stays you want to revisit.' },
                { icon: MessageSquare, title: 'Messages', copy: 'Stay connected with hosts before and during your stay.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="card-surface p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-control bg-brand/10 text-brand">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">{item.copy}</p>
                    <button onClick={onClose} className="btn-ghost mt-3 !px-0 !text-brand">
                      Explore stays
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {!canHost && (
              <div className="card-surface flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="section-label">Have a place to list?</p>
                  <h3 className="mt-2 text-2xl font-semibold text-ink">Become a host on StayLoop</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">
                    Unlock host tools, PMS integrations, listings, and booking management — while keeping full guest access.
                  </p>
                </div>
                <button onClick={becomeHost} className="btn-primary shrink-0">
                  Become a host
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex shrink-0 items-center gap-3 rounded-control px-4 py-2.5 text-sm font-semibold transition ${
                        active ? 'bg-page-muted text-ink' : 'text-ink-muted hover:bg-page-muted/60 hover:text-ink'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-brand' : ''}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
              <div className="mt-6 hidden lg:block">
                <ReferralShareCard />
              </div>
            </aside>

            <main className="min-w-0 space-y-8">
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="section-title">Overview</h2>
                    <p className="section-copy mt-1">A snapshot of your hosting performance.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {statCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <div key={card.label} className="card-surface p-5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-ink-muted">{card.label}</span>
                            <Icon className={`h-4 w-4 ${card.tone}`} />
                          </div>
                          <div className={`mt-3 text-2xl font-semibold ${card.tone === 'text-success' ? 'text-success' : 'text-ink'}`}>
                            {card.value}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="card-surface p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-ink">Upcoming reservations</h3>
                        <button onClick={() => setActiveTab('bookings')} className="btn-ghost !px-0 !text-brand !text-sm">
                          View all
                        </button>
                      </div>
                      {upcomingBookings.length === 0 ? (
                        <div className="py-10 text-center">
                          <Calendar className="mx-auto h-10 w-10 text-ink-subtle" />
                          <p className="mt-3 text-sm text-ink-muted">No upcoming reservations</p>
                        </div>
                      ) : (
                        <ul className="mt-4 divide-y divide-border">
                          {upcomingBookings.map((booking) => (
                            <li key={booking.id} className="flex items-center justify-between gap-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-ink">
                                  {formatDate(booking.check_in)} – {formatDate(booking.check_out)}
                                </p>
                                <span className={`mt-1 inline-block rounded-pill px-2 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(booking.status)}`}>
                                  {booking.status}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-ink">${booking.total_amount}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="card-surface p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-ink">Recent earnings</h3>
                        <button onClick={() => setActiveTab('referrals')} className="btn-ghost !px-0 !text-brand !text-sm">
                          View all
                        </button>
                      </div>
                      {recentEarnings.length === 0 ? (
                        <div className="py-10 text-center">
                          <Wallet className="mx-auto h-10 w-10 text-ink-subtle" />
                          <p className="mt-3 text-sm text-ink-muted">No earnings yet</p>
                        </div>
                      ) : (
                        <ul className="mt-4 divide-y divide-border">
                          {recentEarnings.map((earning) => (
                            <li key={earning.id} className="flex items-center justify-between gap-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-ink">Level {earning.referral_level} commission</p>
                                <p className="text-xs text-ink-muted">{formatDate(earning.booking_date)} · {earning.status}</p>
                              </div>
                              <span className="text-sm font-semibold text-success">+${earning.commission_amount}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="lg:hidden">
                    <ReferralShareCard />
                  </div>
                </div>
              )}

              {activeTab === 'properties' && (
                <div className="space-y-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="section-title">Listings</h2>
                      <p className="section-copy mt-1">Manage the homes you host on StayLoop.</p>
                    </div>
                    <button className="btn-primary shrink-0">Add listing</button>
                  </div>

                  {properties.length === 0 ? (
                    <div className="card-surface px-8 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-brand/10 text-brand">
                        <Home className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-ink">No listings yet</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
                        Create your first listing to start welcoming guests and earning.
                      </p>
                      <button className="btn-primary mt-6">List your first property</button>
                    </div>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {properties.map((property) => (
                        <div key={property.id} className="card-surface overflow-hidden">
                          <div className="aspect-[4/3] overflow-hidden bg-page-muted">
                            {property.images[0] ? (
                              <img src={property.images[0]} alt={property.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-ink-subtle">
                                <Home className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="font-semibold text-ink">{property.title}</h4>
                              <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${property.is_active ? 'bg-success-soft text-success' : 'bg-page-muted text-ink-muted'}`}>
                                {property.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                              <MapPin className="h-3.5 w-3.5 text-ink-subtle" />
                              {property.city}, {property.state}
                            </p>
                            <p className="mt-3 text-sm text-ink">
                              <span className="text-lg font-semibold">${property.base_price}</span>
                              <span className="text-ink-muted"> / night</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bookings' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="section-title">Reservations</h2>
                    <p className="section-copy mt-1">Track upcoming and past stays across your listings.</p>
                  </div>

                  {bookings.length === 0 ? (
                    <div className="card-surface px-8 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-brand/10 text-brand">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-ink">No reservations yet</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
                        Once guests book your listings, their reservations will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="card-surface divide-y divide-border">
                      {bookings.map((booking) => (
                        <div key={booking.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                          <div className="flex items-center gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-control bg-page-muted text-ink-muted">
                              <CalendarCheck className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-ink">
                                {formatDate(booking.check_in)} – {formatDate(booking.check_out)}
                              </p>
                              <span className={`mt-1 inline-block rounded-pill px-2 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(booking.status)}`}>
                                {booking.status}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-ink">${booking.total_amount}</p>
                            <p className="text-sm text-success">You earn ${booking.host_payout}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'referrals' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="section-title">Referrals</h2>
                    <p className="section-copy mt-1">Earn commission across three levels when hosts you invite get bookings.</p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                    <ReferralShareCard />
                    <div className="card-surface p-6">
                      <h3 className="text-base font-semibold text-ink">Commission structure</h3>
                      <div className="mt-4 space-y-2">
                        {[
                          ['Level 1 — Direct', '3%'],
                          ['Level 2', '2%'],
                          ['Level 3', '1%'],
                        ].map(([label, pct]) => (
                          <div key={label} className="flex items-center justify-between rounded-control bg-page-muted px-4 py-3">
                            <span className="text-sm font-medium text-ink">{label}</span>
                            <span className="text-sm font-bold text-brand">{pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {earnings.length === 0 ? (
                    <div className="card-surface px-8 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-brand/10 text-brand">
                        <Network className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-ink">No referral earnings yet</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">Share your code to start earning.</p>
                    </div>
                  ) : (
                    <div className="card-surface divide-y divide-border">
                      {earnings.map((earning) => (
                        <div key={earning.id} className="flex items-center justify-between gap-4 p-5">
                          <div>
                            <p className="font-medium text-ink">Level {earning.referral_level} commission</p>
                            <p className="text-sm text-ink-muted">{earning.commission_percentage}% · {earning.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-success">+${earning.commission_amount}</p>
                            <p className="text-xs text-ink-muted">{formatDate(earning.booking_date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'pms' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="section-title">Integrations</h2>
                    <p className="section-copy mt-1">Connect a property management system to sync listings, bookings, and availability.</p>
                  </div>
                  <PMSSettings />
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
