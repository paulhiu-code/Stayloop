import Stripe from 'stripe';
import pg from 'pg';
import { confirmBookingByPaymentIntent, sendBookingCancelledEmails } from './booking-emails.js';

const { Pool } = pg;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

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
        await confirmBookingByPaymentIntent(pool, paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object;
        const { rows } = await pool.query(
          `UPDATE bookings
             SET status = 'cancelled',
                 updated_at = now()
           WHERE stripe_payment_intent_id = $1
             AND status = 'pending'
           RETURNING id`,
          [paymentIntent.id]
        );

        if (rows[0]?.id) {
          await sendBookingCancelledEmails(pool, rows[0].id);
        }
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
