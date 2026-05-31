import { supabase, type Booking, type Property, type ReferralEarning } from './supabase';

export type BookingWithProperty = Booking & {
  property: Pick<Property, 'id' | 'title' | 'city' | 'state' | 'images'> | null;
};

export type GuestDashboardStats = {
  upcomingTrips: number;
  pastTrips: number;
  totalSpent: number;
};

export type HostDashboardStats = {
  totalEarnings: number;
  pendingEarnings: number;
  totalReferrals: number;
  activeProperties: number;
  totalBookings: number;
  upcomingBookings: number;
};

export function propertyCoverImage(images: unknown): string {
  if (Array.isArray(images) && images.length > 0) {
    return String(images[0]);
  }
  if (typeof images === 'string' && images.length > 0) {
    return images;
  }
  return '';
}

export function formatBookingDates(checkIn: string, checkOut: string): string {
  return `${checkIn} → ${checkOut}`;
}

export function isUpcomingBooking(booking: Booking): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return booking.check_out >= today && booking.status !== 'cancelled';
}

export function bookingStatusLabel(status: Booking['status']): string {
  return status.replace('_', ' ');
}

const BOOKING_WITH_PROPERTY =
  '*, property:properties(id, title, city, state, images)';

export async function fetchGuestBookings(userId: string): Promise<BookingWithProperty[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_WITH_PROPERTY)
    .or(`guest_id.eq.${userId},guest_user_id.eq.${userId}`)
    .order('check_in', { ascending: false });

  if (error) throw error;
  return (data || []) as BookingWithProperty[];
}

export async function fetchHostBookings(userId: string): Promise<BookingWithProperty[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_WITH_PROPERTY)
    .or(`host_id.eq.${userId},host_user_id.eq.${userId}`)
    .order('check_in', { ascending: false });

  if (error) throw error;
  return (data || []) as BookingWithProperty[];
}

export async function fetchHostProperties(userId: string): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('host_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchReferralEarnings(userId: string): Promise<ReferralEarning[]> {
  const { data, error } = await supabase
    .from('referral_earnings')
    .select('*')
    .eq('earner_id', userId)
    .order('booking_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchDirectReferralCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', userId);

  if (error) throw error;
  return count || 0;
}

export function summarizeGuestBookings(bookings: BookingWithProperty[]): GuestDashboardStats {
  const active = bookings.filter((b) => b.status !== 'cancelled');
  return {
    upcomingTrips: active.filter(isUpcomingBooking).length,
    pastTrips: active.filter((b) => !isUpcomingBooking(b)).length,
    totalSpent: active.reduce((sum, b) => sum + Number(b.total_amount || 0), 0),
  };
}

export function summarizeHostBookings(
  bookings: BookingWithProperty[],
  earnings: ReferralEarning[],
  properties: Property[],
  referralCount: number
): HostDashboardStats {
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  return {
    totalEarnings: earnings.reduce((sum, e) => sum + Number(e.commission_amount), 0),
    pendingEarnings: earnings
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + Number(e.commission_amount), 0),
    totalReferrals: referralCount,
    activeProperties: properties.filter((p) => p.is_active).length,
    totalBookings: activeBookings.length,
    upcomingBookings: activeBookings.filter(isUpcomingBooking).length,
  };
}
