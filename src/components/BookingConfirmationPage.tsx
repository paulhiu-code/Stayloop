import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle, Loader2, MapPin, Users } from 'lucide-react';
import { supabase, type Booking, type Property } from '../lib/supabase';

type BookingWithProperty = Booking & {
  properties: Pick<Property, 'title' | 'city' | 'state' | 'images'> | null;
};

export default function BookingConfirmationPage({
  bookingId,
  onClose,
  onViewProperty,
}: {
  bookingId: string;
  onClose: () => void;
  onViewProperty: (propertyId: string) => void;
}) {
  const [booking, setBooking] = useState<BookingWithProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadBooking() {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select('*, properties(title, city, state, images)')
        .eq('id', bookingId)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
      } else if (!data) {
        setError('Booking not found.');
      } else {
        setBooking(data as BookingWithProperty);
      }

      setLoading(false);
    }

    loadBooking();
  }, [bookingId]);

  const property = booking?.properties;
  const image = property?.images?.[0];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={onClose}
          className="mb-8 inline-flex items-center gap-2 font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to StayLoop
        </button>

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-3xl bg-white p-12 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            <span className="text-gray-600">Loading your trip...</span>
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-rose-50 p-8 text-rose-700 shadow-xl">{error}</div>
        ) : booking ? (
          <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-10 text-white">
              <CheckCircle className="h-12 w-12" />
              <h1 className="mt-5 text-4xl font-extrabold">Your trip is confirmed</h1>
              <p className="mt-3 text-emerald-50">
                {booking.status === 'confirmed'
                  ? 'Payment received. Trip details are saved to your dashboard.'
                  : 'Your reservation is being finalized. Check back shortly for confirmation.'}
              </p>
            </div>

            {image && (
              <div className="aspect-[16/9] overflow-hidden">
                <img src={image} alt={property?.title || 'Property'} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="space-y-6 p-8">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-600">Reservation</p>
                <h2 className="mt-2 text-3xl font-extrabold text-gray-900">{property?.title}</h2>
                {property && (
                  <p className="mt-2 flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    {property.city}, {property.state}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                    <Calendar className="h-4 w-4" />
                    Dates
                  </div>
                  <p className="mt-2 font-semibold text-gray-900">
                    {booking.check_in} → {booking.check_out}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {booking.total_nights} night{booking.total_nights === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                    <Users className="h-4 w-4" />
                    Guests
                  </div>
                  <p className="mt-2 font-semibold text-gray-900">
                    {booking.num_guests} guest{booking.num_guests === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-sm capitalize text-gray-500">Status: {booking.status}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Stay subtotal</span>
                  <span className="font-semibold">${Number(booking.base_amount).toFixed(2)}</span>
                </div>
                {Number(booking.cleaning_fee) > 0 && (
                  <div className="mt-2 flex justify-between">
                    <span className="text-gray-600">Cleaning fee</span>
                    <span className="font-semibold">${Number(booking.cleaning_fee).toFixed(2)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between">
                  <span className="text-gray-600">Guest service fee</span>
                  <span className="font-semibold">${Number(booking.guest_service_fee).toFixed(2)}</span>
                </div>
                <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-base">
                  <span className="font-bold text-gray-900">Total paid</span>
                  <span className="font-extrabold text-gray-900">${Number(booking.total_amount).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onViewProperty(booking.property_id)}
                  className="rounded-2xl border border-gray-200 px-6 py-3 font-bold text-gray-700 hover:bg-gray-50"
                >
                  View property
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3 font-bold text-white shadow-lg"
                >
                  Explore more stays
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
