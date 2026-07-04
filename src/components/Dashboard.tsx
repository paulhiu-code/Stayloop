import { useEffect, useState } from 'react';
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
  Mail,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { REFERRAL_LEVEL_LABELS } from '../lib/fees';
import { supabase, ReferralEarning, Property, Booking } from '../lib/supabase';
import EmailCmsDashboard from './admin/EmailCmsDashboard';
import PMSSettings from './PMSSettings';

type DashboardTab = 'overview' | 'properties' | 'bookings' | 'referrals' | 'pms';
type DashboardMode = 'guest' | 'host';
type AdminView = 'main' | 'email-cms';

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

    const totalEarnings =
      earningsRes.data?.reduce((sum, e) => sum + Number(e.payout_amount ?? e.commission_amount), 0) || 0;
    const pendingEarnings =
      earningsRes.data
        ?.filter((e) => e.status === 'pending')
        .reduce((sum, e) => sum + Number(e.payout_amount ?? e.commission_amount), 0) || 0;

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
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'referrals', label: 'Referrals', icon: Network },
    { id: 'pms', label: 'PMS Integrations', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-auto">
      <div className="min-h-screen">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-rose-500 rounded-xl flex items-center justify-center">
                  <Home className="w-6 h-6 text-white" />
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
                      onClick={() => setDashboardMode('guest')}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                        dashboardMode === 'guest'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Guest
                    </button>
                    <button
                      onClick={() => setDashboardMode('host')}
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
                  className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isAdmin && (
            <div className="mb-8 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-2 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAdminView('main')}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    adminView === 'main'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  My dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setAdminView('email-cms')}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    adminView === 'email-cms'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-orange-700 hover:bg-orange-100'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  Email CMS
                </button>
              </div>
            </div>
          )}

          {adminView === 'email-cms' && isAdmin ? (
            <div className="-mx-4 overflow-hidden rounded-3xl border border-slate-800 sm:mx-0">
              <EmailCmsDashboard embedded onClose={() => setAdminView('main')} />
            </div>
          ) : dashboardMode === 'guest' ? (
            <div className="space-y-8">
              <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl">
                <div className="max-w-3xl">
                  <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-orange-300">
                    Guest mode
                  </p>
                  <h2 className="text-4xl font-extrabold tracking-tight">
                    Plan trips, save stays, and come back when you are ready to book.
                  </h2>
                  <p className="mt-4 text-lg leading-8 text-slate-300">
                    Your guest dashboard will hold saved stays, upcoming trips, messages, and booking details as StayLoop grows.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {[
                  ['Saved stays', 'Shortlist homes, cabins, beach houses, and city stays you want to revisit.'],
                  ['Upcoming trips', 'Keep reservation details, check-in notes, and support in one place.'],
                  ['Messages', 'Stay connected with hosts before and during a stay.'],
                ].map(([title, copy]) => (
                  <div key={title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="text-xl font-extrabold text-gray-900">{title}</h3>
                    <p className="mt-3 leading-7 text-gray-600">{copy}</p>
                  </div>
                ))}
              </div>

              {!canHost && (
                <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-8 shadow-sm">
                  <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-600">
                        Have a place to list?
                      </p>
                      <h3 className="mt-3 text-3xl font-extrabold text-gray-900">Become a host on StayLoop</h3>
                      <p className="mt-3 max-w-2xl leading-7 text-gray-600">
                        Upgrade your account to unlock host tools, PMS integrations, property listings, and booking management while keeping guest access.
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
          <div className="mb-8 bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Your Referral Code</h2>
                <p className="text-white/90">Share this code and earn passive income</p>
              </div>
              <Users className="w-12 h-12 text-white/80" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl px-6 py-4">
                <span className="text-3xl font-bold tracking-wider">{profile?.referral_code}</span>
              </div>
              <button
                onClick={copyReferralCode}
                className="px-6 py-4 bg-white text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-all shadow-lg flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Code
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                ${stats.totalEarnings.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">Total Earnings</div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                ${stats.pendingEarnings.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">Pending Earnings</div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalReferrals}</div>
              <div className="text-sm text-gray-500">Direct Referrals</div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Home className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.activeProperties}</div>
              <div className="text-sm text-gray-500">Active Properties</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100">
              <div className="flex gap-4 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-4 border-b-2 font-medium transition ${
                        activeTab === tab.id
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
                    <div className="text-gray-500 text-center py-12">
                      No recent activity to display
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'properties' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Your Properties</h3>
                    <button className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-rose-600 transition-all shadow-md">
                      Add Property
                    </button>
                  </div>
                  {properties.length === 0 ? (
                    <div className="text-center py-12">
                      <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No properties listed yet</p>
                      <button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-rose-600 transition-all shadow-md">
                        List Your First Property
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {properties.map((property) => (
                        <div
                          key={property.id}
                          className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-orange-200 transition"
                        >
                          <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={property.images[0] || ''}
                              alt={property.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{property.title}</h4>
                            <p className="text-sm text-gray-500">
                              {property.city}, {property.state}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              ${property.base_price}/night
                            </div>
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
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Your Bookings</h3>
                  {bookings.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No bookings yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="p-4 border border-gray-200 rounded-xl hover:border-orange-200 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-900">
                                {booking.check_in} - {booking.check_out}
                              </div>
                              <div className="text-sm text-gray-500">{booking.status}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">
                                ${booking.total_amount}
                              </div>
                              <div className="text-sm text-green-600">
                                You earn: ${booking.host_payout}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'referrals' && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Referral Network</h3>
                  <div className="bg-gradient-to-br from-orange-50 to-rose-50 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Commission Structure</div>
                        <div className="text-xs text-gray-500">Earn from 3 levels deep · StayLoop partners on upstream share</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {REFERRAL_LEVEL_LABELS.map((row) => (
                        <div key={row.level} className="flex items-center justify-between py-2">
                          <span className="text-sm font-medium text-gray-700">
                            Level {row.level} {row.level === 1 ? '(Direct)' : ''}
                          </span>
                          <div className="text-right">
                            <span className="font-bold text-orange-600">{row.displayRate}</span>
                            <span className="ml-2 text-xs text-gray-500">({row.payoutRate} payout)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {earnings.length === 0 ? (
                    <div className="text-center py-12">
                      <Network className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-2">No referral earnings yet</p>
                      <p className="text-sm text-gray-400">Share your code to start earning</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {earnings.map((earning) => (
                        <div
                          key={earning.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-xl"
                        >
                          <div>
                            <div className="font-medium text-gray-900">
                              Level {earning.referral_level} Commission
                            </div>
                            <div className="text-sm text-gray-500">
                              {earning.commission_percentage}% rate · {earning.status}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              +${Number(earning.payout_amount ?? earning.commission_amount).toFixed(2)}
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

              {activeTab === 'pms' && (
                <PMSSettings />
              )}
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
