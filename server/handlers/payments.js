import { confirmBookingAndSendEmails, sendHostPayoutEmail } from '../booking-emails.js';
import { calculateFeesFromTaxable } from '../fees.js';
import { finalizeBookingPayment } from '../revShare.js';
import { getPool } from '../lib/db.js';
import { assertStripeConfigured, getStripe } from '../lib/stripe.js';

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
  const fees = calculateFeesFromTaxable(subtotal, cleaningFee);

  return {
    property,
    nights,
    subtotal: Number(subtotal.toFixed(2)),
    cleaningFee,
    fees,
    totalAmountCents: fees.totalCents,
    applicationFeeCents: fees.applicationFeeCents,
    hostPayoutCents: fees.hostPayoutCents,
  };
}

async function getHostByStripeAccountId(accountId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, stripe_account_id, stripe_charges_enabled
     FROM profiles
     WHERE stripe_account_id = $1
     LIMIT 1`,
    [accountId]
  );

  return rows[0] || null;
}

export async function createConnectAccount(user) {
  assertStripeConfigured();
  const stripe = getStripe();
  const pool = getPool();

  const existing = await pool.query(
    `SELECT stripe_account_id FROM profiles WHERE id = $1 LIMIT 1`,
    [user.id]
  );

  if (existing.rows[0]?.stripe_account_id) {
    return { accountId: existing.rows[0].stripe_account_id };
  }

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { stayloop_user_id: user.id },
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
    [account.id, user.id]
  );

  return { accountId: account.id };
}

export async function createOnboardingLink(user, { accountId, returnUrl, refreshUrl }) {
  assertStripeConfigured();
  const stripe = getStripe();

  if (!accountId || !returnUrl || !refreshUrl) {
    throw Object.assign(new Error('accountId, returnUrl, and refreshUrl are required'), { statusCode: 400 });
  }

  assertAllowedRedirectUrl(returnUrl, 'returnUrl');
  assertAllowedRedirectUrl(refreshUrl, 'refreshUrl');

  const host = await getHostByStripeAccountId(accountId);
  if (!host || host.id !== user.id) {
    throw Object.assign(new Error('Stripe account does not belong to authenticated host'), { statusCode: 403 });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return { url: accountLink.url };
}

export async function getAccountStatus(user, accountId) {
  assertStripeConfigured();
  const stripe = getStripe();
  const pool = getPool();

  if (!accountId || typeof accountId !== 'string') {
    throw Object.assign(new Error('accountId is required'), { statusCode: 400 });
  }

  const host = await getHostByStripeAccountId(accountId);
  if (!host || host.id !== user.id) {
    throw Object.assign(new Error('Stripe account does not belong to authenticated host'), { statusCode: 403 });
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
    [onboardingComplete, account.charges_enabled, account.payouts_enabled, user.id]
  );

  return {
    accountId: account.id,
    detailsSubmitted: account.details_submitted,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    onboardingComplete,
    requirements: account.requirements,
  };
}

export async function createPaymentIntent(user, body) {
  assertStripeConfigured();
  const stripe = getStripe();
  const pool = getPool();

  const { propertyId, hostStripeAccountId, checkIn, checkOut, numGuests = 1 } = body;

  if (!propertyId || !hostStripeAccountId || !checkIn || !checkOut) {
    throw Object.assign(
      new Error('propertyId, hostStripeAccountId, checkIn, and checkOut are required'),
      { statusCode: 400 }
    );
  }

  const quote = await loadPropertyQuote(pool, { propertyId, checkIn, checkOut, numGuests });
  if (quote.error) {
    throw Object.assign(new Error(quote.error), { statusCode: quote.status });
  }

  const host = await getHostByStripeAccountId(hostStripeAccountId);
  if (!host || host.id !== quote.property.host_id) {
    throw Object.assign(new Error('Stripe account does not match property host'), { statusCode: 403 });
  }

  if (!host.stripe_charges_enabled) {
    throw Object.assign(new Error('Host has not finished Stripe payout setup yet'), { statusCode: 409 });
  }

  const { totalAmountCents, applicationFeeCents, fees } = quote;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmountCents,
    currency: 'usd',
    application_fee_amount: applicationFeeCents,
    transfer_data: { destination: hostStripeAccountId },
    payment_method_types: ['card'],
    metadata: {
      property_id: propertyId,
      guest_user_id: user.id,
      host_user_id: host.id,
    },
  });

  const { rows } = await pool.query(
    `INSERT INTO bookings (
       property_id, guest_id, host_id, guest_user_id, host_user_id,
       check_in, check_out, check_in_date, check_out_date,
       num_guests, total_nights,
       base_amount, cleaning_fee, guest_service_fee, host_service_fee,
       total_amount, host_payout, status,
       payment_intent_id, stripe_payment_intent_id,
       total_amount_cents, platform_fee_amount, payout_status
     ) VALUES (
       $1, $2, $3, $2, $3, $4, $5, $4, $5, $10, $11,
       $6, $7, $8, $9, $12, $13,
       'pending', $14, $14, $15, $16, 'pending'
     ) RETURNING id`,
    [
      propertyId,
      user.id,
      host.id,
      checkIn,
      checkOut,
      quote.subtotal,
      quote.cleaningFee,
      fees.guestServiceFeeCents / 100,
      fees.hostServiceFeeCents / 100,
      Number(numGuests) || 1,
      quote.nights,
      totalAmountCents / 100,
      fees.hostPayoutCents / 100,
      paymentIntent.id,
      totalAmountCents,
      applicationFeeCents,
    ]
  );

  return {
    bookingId: rows[0].id,
    clientSecret: paymentIntent.client_secret,
    applicationFeeCents,
    totalAmountCents,
    hostPayoutCents: fees.hostPayoutCents,
  };
}

export async function confirmBookingPayment(user, bookingId, paymentIntentId) {
  assertStripeConfigured();
  const stripe = getStripe();
  const pool = getPool();

  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    throw Object.assign(new Error('paymentIntentId is required'), { statusCode: 400 });
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== 'succeeded') {
    throw Object.assign(new Error('Payment has not succeeded yet'), { statusCode: 400 });
  }

  const revShare = await finalizeBookingPayment(paymentIntentId);
  const emails = await confirmBookingAndSendEmails(pool, {
    bookingId,
    paymentIntentId,
    userId: user.id,
  });

  return { ...revShare, emails };
}

export async function releaseBookingPayout(user, bookingId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `UPDATE bookings
     SET payout_status = 'released',
         payout_date = now(),
         updated_at = now()
     WHERE id = $1
       AND (host_id = $2 OR host_user_id = $2)
     RETURNING id, payout_status, payout_date`,
    [bookingId, user.id]
  );

  if (!rows[0]) {
    throw Object.assign(new Error('Booking not found for authenticated host'), { statusCode: 404 });
  }

  try {
    await sendHostPayoutEmail(pool, bookingId);
  } catch (emailError) {
    console.error('Payout email failed:', emailError);
  }

  return { booking: rows[0] };
}
