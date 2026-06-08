import express from 'express';
import Stripe from 'stripe';
import pg from 'pg';
import { confirmBookingAndSendEmails, sendHostPayoutEmail } from '../server/booking-emails.js';

const { Pool } = pg;

export const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 10);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
});

const router = express.Router();

function requireUser(req, res, next) {
  const userId = req.user?.id;

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

function assertAllowedRedirectUrl(url, label) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw Object.assign(new Error(`${label} must be a valid URL`), { statusCode: 400 });
  }

  const allowedOrigins = (process.env.ALLOWED_REDIRECT_ORIGINS || process.env.SITE_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (
    allowedOrigins.length === 0 ||
    !allowedOrigins.some((origin) => parsed.origin === new URL(origin).origin)
  ) {
    throw Object.assign(new Error(`${label} origin is not allowed`), { statusCode: 400 });
  }
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eachNight(checkIn, checkOut) {
  const nights = [];
  let cursor = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);

  while (cursor < end) {
    nights.push(formatDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return nights;
}

async function loadPropertyQuote(poolClient, { propertyId, checkIn, checkOut, numGuests }) {
  const { rows: propertyRows } = await poolClient.query(
    `SELECT id, host_id, base_price, cleaning_fee, min_nights, max_nights, max_guests
     FROM properties
     WHERE id = $1 AND is_active = true
     LIMIT 1`,
    [propertyId]
  );

  const property = propertyRows[0];
  if (!property) {
    return { error: 'Property not found', status: 404 };
  }

  const nights = eachNight(checkIn, checkOut).length;
  if (nights <= 0) {
    return { error: 'Select a valid check-in and check-out', status: 400 };
  }

  if (nights < property.min_nights || nights > property.max_nights) {
    return { error: 'Stay length is outside property limits', status: 400 };
  }

  if (Number(numGuests) > property.max_guests) {
    return { error: 'Guest count exceeds property capacity', status: 400 };
  }

  const { rows: calendarRows } = await poolClient.query(
    `SELECT date, is_available, price_override
     FROM availability_calendar
     WHERE property_id = $1 AND date >= $2::date AND date < $3::date
     ORDER BY date ASC`,
    [propertyId, checkIn, checkOut]
  );

  for (const day of calendarRows) {
    if (day.is_available === false) {
      return { error: `Date ${day.date} is not available`, status: 409 };
    }
  }

  const { rows: overlapRows } = await poolClient.query(
    `SELECT 1
     FROM bookings
     WHERE property_id = $1
       AND status IN ('pending', 'confirmed', 'checked_in')
       AND check_in < $3::date
       AND check_out > $2::date
     LIMIT 1`,
    [propertyId, checkIn, checkOut]
  );

  if (overlapRows[0]) {
    return { error: 'Selected dates overlap an existing reservation', status: 409 };
  }

  const calendarByDate = new Map(calendarRows.map((row) => [row.date, row]));
  let subtotal = 0;

  for (const date of eachNight(checkIn, checkOut)) {
    const override = calendarByDate.get(date)?.price_override;
    subtotal += Number(override ?? property.base_price);
  }

  const cleaningFee = Number(property.cleaning_fee || 0);
  const taxable = subtotal + cleaningFee;
  const guestServiceFee = Number((taxable * 0.05).toFixed(2));
  const hostServiceFee = Number((taxable * 0.1).toFixed(2));
  const total = Number((taxable + guestServiceFee).toFixed(2));
  const hostPayout = Number((taxable - hostServiceFee).toFixed(2));
  const totalAmountCents = Math.round(total * 100);
  const platformFeeCents = Math.round(totalAmountCents * (PLATFORM_FEE_PERCENT / 100));

  return {
    property,
    nights,
    subtotal: Number(subtotal.toFixed(2)),
    cleaningFee,
    guestServiceFee,
    hostServiceFee,
    total,
    hostPayout,
    totalAmountCents,
    platformFeeCents,
  };
}

async function getHostByStripeAccountId(accountId) {
  const { rows } = await pool.query(
    `SELECT id, stripe_account_id, stripe_charges_enabled
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

    assertAllowedRedirectUrl(returnUrl, 'returnUrl');
    assertAllowedRedirectUrl(refreshUrl, 'refreshUrl');

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

    const { propertyId, hostStripeAccountId, checkIn, checkOut, numGuests = 1 } = req.body;

    if (!propertyId || !hostStripeAccountId || !checkIn || !checkOut) {
      return res.status(400).json({
        error: 'propertyId, hostStripeAccountId, checkIn, and checkOut are required',
      });
    }

    const quote = await loadPropertyQuote(pool, { propertyId, checkIn, checkOut, numGuests });
    if (quote.error) {
      return res.status(quote.status).json({ error: quote.error });
    }

    const host = await getHostByStripeAccountId(hostStripeAccountId);

    if (!host || host.id !== quote.property.host_id) {
      return res.status(403).json({ error: 'Stripe account does not match property host' });
    }

    if (!host.stripe_charges_enabled) {
      return res.status(409).json({ error: 'Host has not finished Stripe payout setup yet' });
    }

    const { totalAmountCents, platformFeeCents } = quote;

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
         $1, $2, $3, $2, $3, $4, $5, $4, $5, $10, $11,
         $6, $7, $8, $9, $12, $13,
         'pending', $14, $14, $15, $16, 'pending'
       )
       RETURNING id`,
      [
        propertyId,
        req.stayloopUserId,
        host.id,
        checkIn,
        checkOut,
        quote.subtotal,
        quote.cleaningFee,
        quote.guestServiceFee,
        quote.hostServiceFee,
        Number(numGuests) || 1,
        quote.nights,
        quote.total,
        quote.hostPayout,
        paymentIntent.id,
        totalAmountCents,
        platformFeeCents,
      ]
    );

    return res.json({
      bookingId: rows[0].id,
      clientSecret: paymentIntent.client_secret,
      platformFeeCents,
      totalAmountCents,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/bookings/:bookingId/confirm-payment', requireUser, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { paymentIntentId } = req.body;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ error: 'paymentIntentId is required' });
    }

    const result = await confirmBookingAndSendEmails(pool, {
      bookingId,
      paymentIntentId,
      userId: req.stayloopUserId,
    });

    return res.json(result);
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

    try {
      await sendHostPayoutEmail(pool, bookingId);
    } catch (emailError) {
      console.error('Payout email failed:', emailError);
    }

    return res.json({ booking: rows[0] });
  } catch (error) {
    return next(error);
  }
});

export default router;
