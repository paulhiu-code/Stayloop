import { supabase, type Property } from './supabase';

export type CalendarDay = {
  date: string;
  is_available: boolean;
  price_override: number | null;
  min_nights_override: number | null;
};

export type BookingQuote = {
  nights: number;
  nightlyRates: { date: string; rate: number }[];
  subtotal: number;
  cleaningFee: number;
  guestServiceFee: number;
  hostServiceFee: number;
  total: number;
  hostPayout: number;
};

const GUEST_FEE_RATE = 0.05;
const HOST_FEE_RATE = 0.1;

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in'] as const;

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function eachNight(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  let cursor = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);

  while (cursor < end) {
    nights.push(formatDateOnly(cursor));
    cursor = addDays(cursor, 1);
  }

  return nights;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return eachNight(checkIn, checkOut).length;
}

export async function fetchCalendarDays(
  propertyId: string,
  from: string,
  to: string
): Promise<CalendarDay[]> {
  const { data, error } = await supabase
    .from('availability_calendar')
    .select('date, is_available, price_override, min_nights_override')
    .eq('property_id', propertyId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as CalendarDay[];
}

export async function fetchBlockingBookings(propertyId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('check_in, check_out, status')
    .eq('property_id', propertyId)
    .in('status', [...ACTIVE_BOOKING_STATUSES])
    .lt('check_in', to)
    .gt('check_out', from);

  if (error) throw error;
  return data || [];
}

function datesOverlap(
  checkIn: string,
  checkOut: string,
  blockedCheckIn: string,
  blockedCheckOut: string
): boolean {
  return checkIn < blockedCheckOut && checkOut > blockedCheckIn;
}

export async function isRangeAvailable(
  property: Property,
  checkIn: string,
  checkOut: string
): Promise<{ available: boolean; reason?: string }> {
  const nights = nightsBetween(checkIn, checkOut);

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return { available: false, reason: 'Select a valid check-in and check-out.' };
  }

  if (nights < property.min_nights) {
    return {
      available: false,
      reason: `Minimum stay is ${property.min_nights} night${property.min_nights === 1 ? '' : 's'}.`,
    };
  }

  if (nights > property.max_nights) {
    return {
      available: false,
      reason: `Maximum stay is ${property.max_nights} nights.`,
    };
  }

  const nightDates = eachNight(checkIn, checkOut);
  const calendar = await fetchCalendarDays(property.id, checkIn, checkOut);
  const calendarByDate = new Map(calendar.map((day) => [day.date, day]));

  for (const date of nightDates) {
    const day = calendarByDate.get(date);
    if (day?.is_available === false) {
      return { available: false, reason: `${date} is not available.` };
    }
  }

  const bookings = await fetchBlockingBookings(property.id, checkIn, checkOut);
  for (const booking of bookings) {
    if (datesOverlap(checkIn, checkOut, booking.check_in, booking.check_out)) {
      return { available: false, reason: 'Those dates overlap an existing reservation.' };
    }
  }

  return { available: true };
}


export function effectiveDisplayNightlyRate(
  property: Property,
  calendarDays: CalendarDay[] = []
): number {
  if (Number(property.base_price) > 0) {
    return Number(property.base_price);
  }

  const calendarRates = calendarDays
    .map((day) => (day.price_override != null ? Number(day.price_override) : 0))
    .filter((rate) => rate > 0);

  if (calendarRates.length === 0) {
    return 0;
  }

  const total = calendarRates.reduce((sum, rate) => sum + rate, 0);
  return Number((total / calendarRates.length).toFixed(2));
}

export function calculateQuote(
  property: Property,
  checkIn: string,
  checkOut: string,
  calendarDays: CalendarDay[] = []
): BookingQuote | null {
  const nightDates = eachNight(checkIn, checkOut);
  if (nightDates.length === 0) return null;

  const calendarByDate = new Map(calendarDays.map((day) => [day.date, day]));
  const nightlyRates = nightDates.map((date) => {
    const override = calendarByDate.get(date)?.price_override;
    const rate = override != null ? Number(override) : Number(property.base_price);
    return { date, rate };
  });

  const subtotal = nightlyRates.reduce((sum, night) => sum + night.rate, 0);
  const cleaningFee = Number(property.cleaning_fee || 0);
  const taxable = subtotal + cleaningFee;
  const guestServiceFee = Number((taxable * GUEST_FEE_RATE).toFixed(2));
  const hostServiceFee = Number((taxable * HOST_FEE_RATE).toFixed(2));
  const total = Number((taxable + guestServiceFee).toFixed(2));
  const hostPayout = Number((taxable - hostServiceFee).toFixed(2));

  return {
    nights: nightDates.length,
    nightlyRates,
    subtotal: Number(subtotal.toFixed(2)),
    cleaningFee,
    guestServiceFee,
    hostServiceFee,
    total,
    hostPayout,
  };
}

export async function fetchHostStripeAccountId(hostId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', hostId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.stripe_account_id || !data.stripe_charges_enabled) {
    return data?.stripe_account_id || null;
  }

  return data.stripe_account_id;
}
