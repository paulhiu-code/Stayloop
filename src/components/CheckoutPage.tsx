import { FormEvent, useEffect, useState } from 'react';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { supabase } from '../lib/supabase';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

type CheckoutFormProps = {
  bookingId: string;
  clientSecret: string;
};

function CheckoutForm({ bookingId, clientSecret }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!stripe || !elements) return;

    const card = elements.getElement(CardElement);
    if (!card) return;

    setLoading(true);
    setError('');

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card,
      },
    });

    if (result.error) {
      setError(result.error.message || 'Payment failed.');
    } else if (result.paymentIntent?.status === 'succeeded') {
      try {
        await apiRequest(`/api/bookings/${bookingId}/confirm-payment`, {
          method: 'POST',
          body: { paymentIntentId: result.paymentIntent.id },
        });
      } catch (confirmError) {
        console.error('Booking confirmation fallback failed:', confirmError);
      }

      setConfirmed(true);
    }

    setLoading(false);
  }

  if (confirmed) {
    return (
      <div className="rounded-3xl bg-green-50 p-8 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="mt-5 text-3xl font-extrabold text-green-950">Booking confirmed</h2>
        <p className="mt-3 text-green-800">Your payment was successful. We will send trip details shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <CardElement options={{ hidePostalCode: true }} />
      </div>

      {error && <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</div>}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-4 font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Confirm and pay
      </button>
    </form>
  );
}

export default function CheckoutPage({ onClose }: { onClose: () => void }) {
  const params = new URLSearchParams(window.location.search);
  const [bookingId, setBookingId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [propertyTitle, setPropertyTitle] = useState('');

  const checkIn = params.get('checkIn');
  const checkOut = params.get('checkOut');
  const numGuests = params.get('numGuests');
  const totalAmountCents = Number(params.get('totalAmountCents') || 0);
  const propertyId = params.get('propertyId');
  const hostStripeAccountId = params.get('hostStripeAccountId');

  useEffect(() => {
    async function loadSummary() {
      if (!propertyId) return;
      const { data } = await supabase.from('properties').select('title').eq('id', propertyId).maybeSingle();
      if (data?.title) setPropertyTitle(data.title);
    }

    loadSummary();
  }, [propertyId]);

  useEffect(() => {
    async function createPaymentIntent() {
      if (!propertyId || !hostStripeAccountId || !totalAmountCents || !checkIn || !checkOut) {
        setError('Missing booking details. Go back and choose your dates again.');
        setLoading(false);
        return;
      }

      if (!import.meta.env.VITE_API_BASE_URL) {
        setError('Payments are not configured yet. Your dates are saved — checkout will work once the API is live.');
        setLoading(false);
        return;
      }

      try {
        const payload = {
          propertyId,
          hostStripeAccountId,
          totalAmountCents,
          checkIn,
          checkOut,
          numGuests: Number(numGuests || 1),
        };

        const response = await apiRequest<{ bookingId: string; clientSecret: string }>(
          '/api/bookings/create-payment-intent',
          {
            method: 'POST',
            body: payload,
          }
        );

        setBookingId(response.bookingId);
        setClientSecret(response.clientSecret);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start checkout.');
      } finally {
        setLoading(false);
      }
    }

    createPaymentIntent();
  }, []);

  const totalDisplay = totalAmountCents ? (totalAmountCents / 100).toFixed(2) : null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <button onClick={onClose} className="mb-8 inline-flex items-center gap-2 font-semibold text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to StayLoop
        </button>

        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-600">Secure checkout</p>
          <h1 className="mt-3 text-4xl font-extrabold text-gray-900">Complete your booking</h1>
          <p className="mt-3 text-gray-600">Pay securely through Stripe. Platform fees are handled automatically.</p>

          {(propertyTitle || checkIn) && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm">
              {propertyTitle && <p className="font-bold text-gray-900">{propertyTitle}</p>}
              {checkIn && checkOut && (
                <p className="mt-2 text-gray-600">
                  {checkIn} → {checkOut}
                  {numGuests ? ` · ${numGuests} guest${numGuests === '1' ? '' : 's'}` : ''}
                </p>
              )}
              {totalDisplay && (
                <p className="mt-2 text-lg font-extrabold text-gray-900">Total ${totalDisplay}</p>
              )}
            </div>
          )}

          <div className="mt-8">
            {loading && (
              <div className="flex items-center justify-center gap-3 rounded-2xl bg-gray-50 p-8 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing checkout...
              </div>
            )}

            {error && <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</div>}

            {clientSecret && bookingId && (
              <Elements stripe={stripePromise}>
                <CheckoutForm bookingId={bookingId} clientSecret={clientSecret} />
              </Elements>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
