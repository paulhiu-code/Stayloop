export type DashboardTab =
  | 'overview'
  | 'properties'
  | 'bookings'
  | 'referrals'
  | 'pms'
  | 'messages';

export type DashboardMode = 'guest' | 'host';

const HOST_TABS: DashboardTab[] = ['overview', 'properties', 'bookings', 'messages', 'referrals', 'pms'];
const GUEST_TABS: DashboardTab[] = ['bookings', 'messages'];

export function parseDashboardSearch(search: string): {
  mode: DashboardMode;
  tab: DashboardTab;
} {
  const params = new URLSearchParams(search);
  const mode: DashboardMode = params.get('mode') === 'host' ? 'host' : 'guest';
  const tabParam = params.get('tab');
  const allowed = mode === 'host' ? HOST_TABS : GUEST_TABS;
  const fallback: DashboardTab = mode === 'host' ? 'overview' : 'bookings';
  const tab = allowed.includes(tabParam as DashboardTab) ? (tabParam as DashboardTab) : fallback;
  return { mode, tab };
}

export function buildDashboardPath(mode: DashboardMode, tab: DashboardTab): string {
  const params = new URLSearchParams();
  if (mode === 'host') params.set('mode', 'host');
  if (tab !== (mode === 'host' ? 'overview' : 'bookings')) params.set('tab', tab);
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : '/dashboard';
}

export function guestTabs(): DashboardTab[] {
  return GUEST_TABS;
}

export function hostTabs(): DashboardTab[] {
  return HOST_TABS;
}
