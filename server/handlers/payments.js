import { calculateFeesFromTaxable, centsToDollars } from '../fees.js';
import { finalizeBookingPayment } from '../revShare.js';
import { getPool } from '../lib/db.js';
import { assertStripeConfigured, getStripe } from '../lib/stripe.js';

async function getHostByStripeAccountId(accountId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, stripe_account_id
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
    `SELECT stripe_account_id
     FROM profiles
     WHERE id = $1
     LIMIT 1`,
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
    metadata: {
      stayloop_user_id: user.id,
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

  const {
    propertyId,
    hostStripeAccountId,
    totalAmountCents,
    subtotalCents,
    cleaningFeeCents,
    hostPayoutCents,
    guestServiceFeeCents,
    hostServiceFeeCents,
    checkIn,
    checkOut,
    numGuests,
  } = body;

  if (!propertyId || !hostStripeAccountId || !totalAmountCents || !checkIn || !checkOut) {
    throw Object.assign(
      new Error('propertyId, hostStripeAccountId, totalAmountCents, checkIn, and checkOut are required'),
      { statusCode: 400 }
    );
  }

  const host = await getHostByStripeAccountId(hostStripeAccountId);

  if (!host) {
    throw Object.assign(new Error('Host Stripe account not found'), { statusCode: 404 });
  }

  const subtotal = Number(subtotalCents || 0) / 100;
  const cleaningFee = Number(cleaningFeeCents || 0) / 100;
  const expected = calculateFeesFromTaxable(subtotal, cleaningFee);

  const normalizedTotal = Number(totalAmountCents);
  const normalizedHostPayout = Number(hostPayoutCents || expected.hostPayoutCents);
  const normalizedGuestFee = Number(guestServiceFeeCents || expected.guestServiceFeeCents);
  const normalizedHostFee = Number(hostServiceFeeCents || expected.hostServiceFeeCents);

  if (
    Math.abs(normalizedTotal - expected.totalCents) > 1 ||
    Math.abs(normalizedHostPayout - expected.hostPayoutCents) > 1
  ) {
    throw Object.assign(new Error('Checkout fee breakdown does not match platform fee rules'), { statusCode: 400 });
  }

  const applicationFeeCents = normalizedTotal - normalizedHostPayout;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: normalizedTotal,
    currency: 'usd',
    application_fee_amount: applicationFeeCents,
    transfer_data: {
      destination: hostStripeAccountId,
    },
    payment_method_types: ['card'],
    metadata: {
      property_id: propertyId,
      guest_user_id: user.id,
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
       $1, $2, $3, $2, $3, $4, $5, $4, $5, $14, GREATEST(($5::date - $4::date), 1),
       $6, $7, $8, $9, $10, $11,
       'pending', $12, $12, $10, $13, 'pending'
     )
     RETURNING id`,
    [
      propertyId,
      user.id,
      host.id,
      checkIn,
      checkOut,
      centsToDollars(expected.subtotalCents),
      centsToDollars(expected.cleaningFeeCents),
      centsToDollars(normalizedGuestFee),
      centsToDollars(normalizedHostFee),
      centsToDollars(normalizedTotal),
      centsToDollars(normalizedHostPayout),
      paymentIntent.id,
      applicationFeeCents,
      Number(numGuests || 1),
    ]
  );

  return {
    bookingId: rows[0].id,
    clientSecret: paymentIntent.client_secret,
    applicationFeeCents,
    hostPayoutCents: normalizedHostPayout,
  };
}

export async function confirmBookingPayment(user, bookingId, paymentIntentId) {
  assertStripeConfigured();
  const stripe = getStripe();
  const pool = getPool();

  if (!paymentIntentId) {
    throw Object.assign(new Error('paymentIntentId is required'), { statusCode: 400 });
  }

  const { rows } = await pool.query(
    `SELECT id, guest_user_id, guest_id, stripe_payment_intent_id, status
     FROM bookings
     WHERE id = $1
     LIMIT 1`,
    [bookingId]
  );

  const booking = rows[0];
  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  }

  const guestId = booking.guest_user_id || booking.guest_id;
  if (guestId !== user.id) {
    throw Object.assign(new Error('Booking does not belong to authenticated guest'), { statusCode: 403 });
  }

  if (booking.stripe_payment_intent_id !== paymentIntentId) {
    throw Object.assign(new Error('Payment intent does not match booking'), { statusCode: 400 });
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== 'succeeded') {
    throw Object.assign(new Error('Payment has not succeeded yet'), { statusCode: 400 });
  }

  return finalizeBookingPayment(paymentIntentId);
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

  return { booking: rows[0] };
}
