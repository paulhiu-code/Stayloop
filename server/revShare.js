import Stripe from 'stripe';
import pg from 'pg';

const { Pool } = pg;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

/**
 * After a booking is confirmed, pay upstream referrers from the platform Stripe
 * balance via Connect transfers. Commission rows are created by the DB trigger;
 * this function executes the money movement.
 */
export async function distributeReferralPayouts(bookingId, paymentIntentId) {
  const { rows: earnings } = await pool.query(
    `SELECT
       re.id,
       re.referral_level,
       re.commission_amount,
       re.status,
       p.stripe_account_id,
       p.stripe_charges_enabled,
       p.full_name,
       p.email
     FROM referral_earnings re
     JOIN profiles p ON p.id = re.earner_id
     WHERE re.booking_id = $1
       AND re.status = 'pending'
     ORDER BY re.referral_level ASC`,
    [bookingId]
  );

  const results = [];

  for (const earning of earnings) {
    const amountCents = Math.round(Number(earning.commission_amount) * 100);
    if (amountCents <= 0) {
      continue;
    }

    if (!earning.stripe_account_id || !earning.stripe_charges_enabled) {
      results.push({
        earningId: earning.id,
        level: earning.referral_level,
        status: 'pending',
        reason: 'Referrer has not completed Stripe Connect onboarding',
      });
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: earning.stripe_account_id,
        transfer_group: paymentIntentId,
        metadata: {
          booking_id: bookingId,
          referral_earning_id: earning.id,
          referral_level: String(earning.referral_level),
        },
      });

      await pool.query(
        `UPDATE referral_earnings
         SET status = 'paid',
             payout_date = now(),
             stripe_transfer_id = $1
         WHERE id = $2`,
        [transfer.id, earning.id]
      );

      results.push({
        earningId: earning.id,
        level: earning.referral_level,
        status: 'paid',
        transferId: transfer.id,
        amountCents,
      });
    } catch (error) {
      console.error(`Referral transfer failed for earning ${earning.id}:`, error);
      results.push({
        earningId: earning.id,
        level: earning.referral_level,
        status: 'pending',
        reason: error instanceof Error ? error.message : 'Transfer failed',
      });
    }
  }

  return results;
}

/**
 * Confirm booking after successful payment and run referral accrual + payouts.
 */
export async function finalizeBookingPayment(paymentIntentId) {
  const { rows } = await pool.query(
    `UPDATE bookings
     SET status = 'confirmed',
         updated_at = now()
     WHERE stripe_payment_intent_id = $1
       AND status = 'pending'
     RETURNING id`,
    [paymentIntentId]
  );

  if (!rows[0]) {
    const { rows: existing } = await pool.query(
      `SELECT id, status FROM bookings WHERE stripe_payment_intent_id = $1 LIMIT 1`,
      [paymentIntentId]
    );
    if (!existing[0]) {
      return { bookingId: null, payouts: [], message: 'Booking not found' };
    }
    if (existing[0].status === 'confirmed') {
      const payouts = await distributeReferralPayouts(existing[0].id, paymentIntentId);
      return { bookingId: existing[0].id, payouts, message: 'Already confirmed' };
    }
    return { bookingId: null, payouts: [], message: 'Booking not in pending state' };
  }

  const bookingId = rows[0].id;
  const payouts = await distributeReferralPayouts(bookingId, paymentIntentId);
  return { bookingId, payouts, message: 'Confirmed' };
}
