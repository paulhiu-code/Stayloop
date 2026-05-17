import express from 'express';
import Stripe from 'stripe';
import pg from 'pg';

const { Pool } = pg;

export const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 10);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const router = express.Router();

function requireUser(req, res, next) {
  const userId = req.user?.id || req.auth?.userId || req.headers['x-user-id'];

  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ error: 'Authenticated user is required' });
  }

  req.stayloopUserId = userId;
  return next();
}

function assertStripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
}

async function getHostByStripeAccountId(accountId) {
  const { rows } = await pool.query(
    `SELECT id, stripe_account_id
     FROM profiles
     WHERE stripe_account_id = $1
     LIMIT 1`,
    [accountId]
  );

  return rows[0] || null;
}

router.post('/api/stripe/connect/create-account', requireUser, async (req, res, next) => {
  try {
    assertStripeConfigured();

    const existing = await pool.query(
      `SELECT stripe_account_id
       FROM profiles
       WHERE id = $1
       LIMIT 1`,
      [req.stayloopUserId]
    );

    if (existing.rows[0]?.stripe_account_id) {
      return res.json({ accountId: existing.rows[0].stripe_account_id });
    }

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: req.user?.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        stayloop_user_id: req.stayloopUserId,
      },
    });

    await pool.query(
      `UPDATE profiles
       SET stripe_account_id = $1,
           stripe_onboarding_complete = false,
           stripe_charges_enabled = false,
           stripe_payouts_enabled = false,
           user_type = CASE WHEN user_type = 'guest' THEN 'both' ELSE user_type END,
           updated_at = now()
       WHERE id = $2`,
      [account.id, req.stayloopUserId]
    );

    return res.json({ accountId: account.id });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/stripe/connect/create-onboarding-link', requireUser, async (req, res, next) => {
  try {
    assertStripeConfigured();

    const { accountId, returnUrl, refreshUrl } = req.body;

    if (!accountId || !returnUrl || !refreshUrl) {
      return res.status(400).json({ error: 'accountId, returnUrl, and refreshUrl are required' });
    }

    const host = await getHostByStripeAccountId(accountId);

    if (!host || host.id !== req.stayloopUserId) {
      return res.status(403).json({ error: 'Stripe account does not belong to authenticated host' });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return res.json({ url: accountLink.url });
  } catch (error) {
    return next(error);
  }
});

router.get('/api/stripe/connect/account-status', requireUser, async (req, res, next) => {
  try {
    assertStripeConfigured();

    const { accountId } = req.query;

    if (!accountId || typeof accountId !== 'string') {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const host = await getHostByStripeAccountId(accountId);

    if (!host || host.id !== req.stayloopUserId) {
      return res.status(403).json({ error: 'Stripe account does not belong to authenticated host' });
    }

    const account = await stripe.accounts.retrieve(accountId);
    const onboardingComplete =
      account.details_submitted && account.charges_enabled && account.payouts_enabled;

    await pool.query(
      `UPDATE profiles
       SET stripe_onboarding_complete = $1,
           stripe_charges_enabled = $2,
           stripe_payouts_enabled = $3,
           updated_at = now()
       WHERE id = $4`,
      [onboardingComplete, account.charges_enabled, account.payouts_enabled, req.stayloopUserId]
    );

    return res.json({
      accountId: account.id,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      onboardingComplete,
      requirements: account.requirements,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/bookings/create-payment-intent', requireUser, async (req, res, next) => {
  try {
    assertStripeConfigured();

    const {
      propertyId,
      hostStripeAccountId,
      totalAmountCents,
      checkIn,
      checkOut,
    } = req.body;

    if (!propertyId || !hostStripeAccountId || !totalAmountCents || !checkIn || !checkOut) {
      return res.status(400).json({
        error: 'propertyId, hostStripeAccountId, totalAmountCents, checkIn, and checkOut are required',
      });
    }

    const host = await getHostByStripeAccountId(hostStripeAccountId);

    if (!host) {
      return res.status(404).json({ error: 'Host Stripe account not found' });
    }

    const platformFeeCents = Math.round(totalAmountCents * (PLATFORM_FEE_PERCENT / 100));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: 'usd',
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: hostStripeAccountId,
      },
      metadata: {
        property_id: propertyId,
        guest_user_id: req.stayloopUserId,
        host_user_id: host.id,
      },
    });

    const { rows } = await pool.query(
      `INSERT INTO bookings (
         property_id,
         guest_id,
         host_id,
         guest_user_id,
         host_user_id,
         check_in,
         check_out,
         check_in_date,
         check_out_date,
         num_guests,
         total_nights,
         base_amount,
         cleaning_fee,
         guest_service_fee,
         host_service_fee,
         total_amount,
         host_payout,
         status,
         payment_intent_id,
         stripe_payment_intent_id,
         total_amount_cents,
         platform_fee_amount,
         payout_status
       )
       VALUES (
         $1, $2, $3, $2, $3, $4, $5, $4, $5, 1, GREATEST(($5::date - $4::date), 1),
         $6 / 100.0, 0, 0, $7 / 100.0, $6 / 100.0, ($6 - $7) / 100.0,
         'pending', $8, $8, $6, $7, 'pending'
       )
       RETURNING id`,
      [
        propertyId,
        req.stayloopUserId,
        host.id,
        checkIn,
        checkOut,
        totalAmountCents,
        platformFeeCents,
        paymentIntent.id,
      ]
    );

    return res.json({
      bookingId: rows[0].id,
      clientSecret: paymentIntent.client_secret,
      platformFeeCents,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/bookings/:bookingId/release-payout', requireUser, async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const { rows } = await pool.query(
      `UPDATE bookings
       SET payout_status = 'released',
           payout_date = now(),
           updated_at = now()
       WHERE id = $1
         AND (host_id = $2 OR host_user_id = $2)
       RETURNING id, payout_status, payout_date`,
      [bookingId, req.stayloopUserId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Booking not found for authenticated host' });
    }

    return res.json({ booking: rows[0] });
  } catch (error) {
    return next(error);
  }
});

export default router;
