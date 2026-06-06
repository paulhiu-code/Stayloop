import Stripe from 'stripe';
import pg from 'pg';
import { finalizeBookingPayment } from './revShare.js';

const { Pool } = pg;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Stripe webhook handler. This is the authoritative source of truth for the
// booking payment lifecycle: a booking only becomes `confirmed` after Stripe
// reports the PaymentIntent succeeded, and connected-account status is mirrored
// onto the host profile when Stripe sends account.updated.
//
// NOTE: this route must be mounted with a raw body parser so the signature can
// be verified.
export async function handleStripeWebhook(req, res) {
  if (!webhookSecret) {
    return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' });
  }

  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    return res
      .status(400)
      .json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        await finalizeBookingPayment(paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object;
        await pool.query(
          `UPDATE bookings
             SET status = 'cancelled',
                 updated_at = now()
           WHERE stripe_payment_intent_id = $1
             AND status = 'pending'`,
          [paymentIntent.id]
        );
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        const onboardingComplete =
          account.details_submitted && account.charges_enabled && account.payouts_enabled;
        await pool.query(
          `UPDATE profiles
             SET stripe_onboarding_complete = $1,
                 stripe_charges_enabled = $2,
                 stripe_payouts_enabled = $3,
                 updated_at = now()
           WHERE stripe_account_id = $4`,
          [onboardingComplete, account.charges_enabled, account.payouts_enabled, account.id]
        );
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
