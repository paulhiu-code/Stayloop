import { useEffect, useMemo, useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import type { Property } from '../lib/supabase';
import {
  calculateQuote,
  effectiveDisplayNightlyRate,
  eachNight,
  fetchCalendarDays,
  fetchHostStripeAccountId,
  formatDateOnly,
  isRangeAvailable,
  nightsBetween,
} from '../lib/booking';
import BookingDatePicker from './BookingDatePicker';

type BookingWidgetProps = {
  property: Property;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onReserve: (checkoutPath: string) => void;
};

function buildUnavailableSet(calendarDays: { date: string; is_available: boolean }[]) {
  // Only grey dates OwnerRez sync marked blocked. Missing rows stay selectable until sync fills them.
  return new Set(calendarDays.filter((day) => day.is_available === false).map((day) => day.date));
}

export default function BookingWidget({
  property,
  isAuthenticated,
  onRequireAuth,
  onReserve,
}: BookingWidgetProps) {
  const [month, setMonth] = useState(() => new Date());
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(1);
  const [calendarDays, setCalendarDays] = useState<Awaited<ReturnType<typeof fetchCalendarDays>>>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [reserveMessage, setReserveMessage] = useState('');

  const rangeEnd = useMemo(() => {
    const end = new Date(month.getFullYear(), month.getMonth() + 2, 0);
    return formatDateOnly(end);
  }, [month]);

  const rangeStart = useMemo(() => formatDateOnly(new Date()), []);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      setLoadingCalendar(true);
      try {
        const days = await fetchCalendarDays(property.id, rangeStart, rangeEnd);
        if (!cancelled) setCalendarDays(days);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setCalendarDays([]);
        }
      } finally {
        if (!cancelled) setLoadingCalendar(false);
      }
    }

    loadCalendar();
    return () => {
      cancelled = true;
    };
  }, [property.id, rangeStart, rangeEnd]);

  const unavailableDates = useMemo(() => buildUnavailableSet(calendarDays), [calendarDays]);

  const displayNightlyRate = useMemo(
    () => effectiveDisplayNightlyRate(property, calendarDays),
    [property, calendarDays]
  );

  const quote = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    return calculateQuote(property, checkIn, checkOut, calendarDays);
  }, [property, checkIn, checkOut, calendarDays]);

  function handleSelectDate(date: string) {
    setError('');
    setReserveMessage('');

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(date);
      setCheckOut(null);
      return;
    }

    if (date <= checkIn) {
      setCheckIn(date);
      setCheckOut(null);
      return;
    }

    const nights = nightsBetween(checkIn, date);
    const blockedNight = eachNight(checkIn, date).find((night) => unavailableDates.has(night));
    if (blockedNight) {
      setError(`Cannot book across unavailable date ${blockedNight}.`);
      return;
    }

    if (nights < property.min_nights) {
      setError(`Minimum stay is ${property.min_nights} nights.`);
      return;
    }

    setCheckOut(date);
  }

  async function handleReserve() {
    if (!checkIn || !checkOut || !quote) {
      setError('Choose your check-in and check-out dates.');
      return;
    }

    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    if (guests > property.max_guests) {
      setError(`This stay allows up to ${property.max_guests} guests.`);
      return;
    }

    setValidating(true);
    setError('');
    setReserveMessage('');

    try {
      const availability = await isRangeAvailable(property, checkIn, checkOut);
      if (!availability.available) {
        setError(availability.reason || 'Those dates are no longer available.');
        return;
      }

      const hostStripeAccountId = await fetchHostStripeAccountId(property.host_id);
      const params = new URLSearchParams({
        propertyId: property.id,
        checkIn,
        checkOut,
        numGuests: String(guests),
        totalAmountCents: String(Math.round(quote.total * 100)),
        subtotalCents: String(Math.round(quote.subtotal * 100)),
        cleaningFeeCents: String(Math.round(quote.cleaningFee * 100)),
        hostPayoutCents: String(Math.round(quote.hostPayout * 100)),
        guestServiceFeeCents: String(Math.round(quote.guestServiceFee * 100)),
        hostServiceFeeCents: String(Math.round(quote.hostServiceFee * 100)),
      });

      if (hostStripeAccountId) {
        params.set('hostStripeAccountId', hostStripeAccountId);
        onReserve(`/checkout?${params.toString()}`);
        return;
      }

      setReserveMessage(
        'This host has not finished Stripe setup yet. Your dates are valid — payment will be enabled once payouts are connected.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start booking.');
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-gray-900">${displayNightlyRate}</span>
        <span className="text-sm font-medium text-gray-500">/ night</span>
      </div>

      {loadingCalendar ? (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 py-10 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading calendar...
        </div>
      ) : (
        <BookingDatePicker
          month={month}
          onMonthChange={setMonth}
          unavailableDates={unavailableDates}
          checkIn={checkIn}
          checkOut={checkOut}
          onSelectDate={handleSelectDate}
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-gray-200 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Check-in</p>
          <p className="font-semibold text-gray-900">{checkIn || 'Add date'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Check-out</p>
          <p className="font-semibold text-gray-900">{checkOut || 'Add date'}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Guests</p>
          <p className="text-xs text-gray-500">Max {property.max_guests}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={guests <= 1}
            onClick={() => setGuests((count) => Math.max(1, count - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-6 text-center font-bold">{guests}</span>
          <button
            type="button"
            disabled={guests >= property.max_guests}
            onClick={() => setGuests((count) => Math.min(property.max_guests, count + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {quote && (
        <div className="mt-5 space-y-2 border-t border-gray-200 pt-5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">
              ${displayNightlyRate} x {quote.nights} night{quote.nights === 1 ? '' : 's'}
            </span>
            <span className="font-semibold text-gray-900">${quote.subtotal.toFixed(2)}</span>
          </div>
          {quote.cleaningFee > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Cleaning fee</span>
              <span className="font-semibold text-gray-900">${quote.cleaningFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Guest service fee (5%)</span>
            <span className="font-semibold text-gray-900">${quote.guestServiceFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 text-base">
            <span className="font-bold text-gray-900">Total before taxes</span>
            <span className="font-extrabold text-gray-900">${quote.total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {reserveMessage && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{reserveMessage}</p>
      )}

      <button
        type="button"
        onClick={handleReserve}
        disabled={validating || !quote}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-4 font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {validating && <Loader2 className="h-4 w-4 animate-spin" />}
        {property.instant_book ? 'Book now' : 'Reserve'}
      </button>

      <p className="mt-3 text-center text-xs text-gray-500">
        You will not be charged yet. Availability is re-checked before checkout.
      </p>
    </div>
  );
}
