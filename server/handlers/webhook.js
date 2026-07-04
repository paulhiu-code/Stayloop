import { confirmBookingByPaymentIntent, sendBookingCancelledEmails } from '../booking-emails.js';
import { finalizeBookingPayment } from '../revShare.js';
import { getPool } from '../lib/db.js';
import { getStripe } from '../lib/stripe.js';

export async function handleStripeWebhookEvent(rawBody, signature) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!webhookSecret) {
    throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET is not configured'), { statusCode: 500 });
  }

  const stripe = getStripe();
  const pool = getPool();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw Object.assign(
      new Error(`Webhook signature verification failed: ${err.message}`),
      { statusCode: 400 }
    );
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      await finalizeBookingPayment(paymentIntent.id);
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
      if (rows[0]) {
        try {
          await sendBookingCancelledEmails(pool, rows[0].id);
        } catch (err) {
          console.error('Failed to send booking cancellation emails:', err);
        }
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

  return { received: true };
}
