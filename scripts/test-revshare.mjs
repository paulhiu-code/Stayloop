/**
 * StayLoop rev-share + fee integration tests (test mode).
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-revshare.mjs
 *   node --env-file=.env.local scripts/test-revshare.mjs --stripe
 *
 * --fees   (default) Fee math for 0–3 upstream referrers
 * --db     Database referral accrual via booking confirmation trigger
 * --stripe            Single-host destination charge + confirm (auto-creates Custom test account)
 * --stripe-referrals  Two-level referrer Stripe transfers (auto-creates 3 Custom test accounts)
 *
 * Optional: STRIPE_TEST_HOST_ACCOUNT_ID — use a real Express account after /host-onboarding instead of auto-provision
 */

import pg from 'pg';
import Stripe from 'stripe';
import {
  calculateFeesFromTaxable,
  centsToDollars,
  REFERRAL_DISPLAY_RATES,
  REFERRAL_PAYOUT_RATES,
} from '../server/fees.js';
import { finalizeBookingPayment } from '../server/revShare.js';

const { Pool } = pg;

const args = new Set(process.argv.slice(2));
const runFees = args.size === 0 || args.has('--fees');
const runDb = args.size === 0 || args.has('--db');
const runStripe = args.has('--stripe');
const runStripeReferrals = args.has('--stripe-referrals');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition, label, detail) {
  if (condition) ok(label);
  else fail(label, detail);
}

function feeScenario(label, taxable, upstreamLevels) {
  const fees = calculateFeesFromTaxable(taxable, 0, upstreamLevels);
  const expectedDisplayPool = REFERRAL_DISPLAY_RATES.slice(0, upstreamLevels).reduce(
    (sum, rate) => sum + taxable * rate,
    0
  );
  const expectedPayoutPool = REFERRAL_PAYOUT_RATES.slice(0, upstreamLevels).reduce(
    (sum, rate) => sum + taxable * rate,
    0
  );
  const expectedPlatformFromHostPool = taxable * 0.1 - expectedPayoutPool;
  const expectedHostPayout = taxable * 0.9;
  const expectedGuestFee = taxable * 0.05;
  const expectedTotal = taxable + expectedGuestFee;
  const expectedApplicationFee = expectedTotal - expectedHostPayout;

  console.log(`\n${label} (taxable $${taxable}, ${upstreamLevels} upstream level(s))`);
  assert(Math.abs(centsToDollars(fees.hostPayoutCents) - expectedHostPayout) < 0.02, 'Listing host gets 90% of taxable');
  assert(
    Math.abs(centsToDollars(fees.referralDisplayPoolCents) - expectedDisplayPool) < 0.02,
    `Nominal referrer pool is ${upstreamLevels > 0 ? '2/2/1% display slices' : '$0'}`
  );
  assert(
    Math.abs(centsToDollars(fees.referralPayoutPoolCents) - expectedPayoutPool) < 0.02,
    `Net referrer payout pool is ${upstreamLevels > 0 ? '1/1/0.5% after partner share' : '$0'}`
  );
  assert(
    Math.abs(centsToDollars(fees.applicationFeeCents) - expectedApplicationFee) < 0.02,
    'Platform application_fee = guest fee + full host-fee pool'
  );
  assert(
    Math.abs(centsToDollars(fees.platformHostPoolKeepCents) - expectedPlatformFromHostPool) < 0.02,
    upstreamLevels === 3
      ? 'At 3 levels StayLoop keeps 7.5% of taxable from host pool after net payouts'
      : `StayLoop keeps host-pool remainder ($${expectedPlatformFromHostPool.toFixed(2)})`
  );
  console.log(
    `    guest pays $${centsToDollars(fees.totalCents)} | host $${centsToDollars(fees.hostPayoutCents)} | platform fee $${centsToDollars(fees.applicationFeeCents)} | display pool $${centsToDollars(fees.referralDisplayPoolCents)} | net payout pool $${centsToDollars(fees.referralPayoutPoolCents)}`
  );
}

async function pickHosts() {
  const { rows } = await pool.query(
    `SELECT id, email, referred_by
     FROM profiles
     WHERE user_type IN ('host', 'both')
     ORDER BY created_at ASC
     LIMIT 4`
  );
  if (rows.length < 3) throw new Error('Need at least 3 host profiles in the database');
  return rows;
}

async function runDbTests() {
  console.log('\n=== DB referral accrual (booking confirmation trigger) ===');

  const hosts = await pickHosts();
  const [hostA, hostB, hostC] = hosts;
  const saved = hosts.map((h) => ({ id: h.id, referred_by: h.referred_by }));

  const taxable = 1000;
  const fees = calculateFeesFromTaxable(taxable, 0, 3);

  try {
    // --- No upstream referrers ---
    await pool.query(`UPDATE profiles SET referred_by = NULL WHERE id = $1`, [hostC.id]);
    const noRefBooking = await insertPendingBooking(hostC.id, fees);
    await pool.query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [noRefBooking.id]);
    const noRefEarnings = await countEarnings(noRefBooking.id);
    assert(noRefEarnings === 0, 'No upstream referrers → zero referral_earnings rows');
    await cleanupBooking(noRefBooking.id);

    // --- Two-level upstream chain: A → B → C (listing host) ---
    await pool.query(`UPDATE profiles SET referred_by = NULL WHERE id = $1`, [hostA.id]);
    await pool.query(`UPDATE profiles SET referred_by = $1 WHERE id = $2`, [hostA.id, hostB.id]);
    await pool.query(`UPDATE profiles SET referred_by = $1 WHERE id = $2`, [hostB.id, hostC.id]);

    const chainBooking = await insertPendingBooking(hostC.id, fees);
    await pool.query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [chainBooking.id]);

    const { rows: earnings } = await pool.query(
      `SELECT referral_level, commission_amount, payout_amount, commission_percentage, earner_id
       FROM referral_earnings
       WHERE booking_id = $1
       ORDER BY referral_level ASC`,
      [chainBooking.id]
    );

    assert(earnings.length === 2, 'Two upstream hosts → two referral_earnings rows');
    if (earnings.length >= 1) {
      assert(Number(earnings[0].referral_level) === 1, 'Level 1 row present');
      assert(earnings[0].earner_id === hostB.id, 'Level 1 paid to direct referrer (B)');
      assert(Math.abs(Number(earnings[0].commission_percentage) - 2) < 0.01, 'Level 1 display rate = 2%');
      assert(Math.abs(Number(earnings[0].commission_amount) - 20) < 0.01, 'Level 1 display = 2% of $1000 ($20)');
      assert(Math.abs(Number(earnings[0].payout_amount) - 10) < 0.01, 'Level 1 payout = 1% of $1000 ($10)');
    }
    if (earnings.length >= 2) {
      assert(Number(earnings[1].referral_level) === 2, 'Level 2 row present');
      assert(earnings[1].earner_id === hostA.id, 'Level 2 paid to upstream referrer (A)');
      assert(Math.abs(Number(earnings[1].commission_percentage) - 2) < 0.01, 'Level 2 display rate = 2%');
      assert(Math.abs(Number(earnings[1].commission_amount) - 20) < 0.01, 'Level 2 display = 2% of $1000 ($20)');
      assert(Math.abs(Number(earnings[1].payout_amount) - 10) < 0.01, 'Level 2 payout = 1% of $1000 ($10)');
    }

    await cleanupBooking(chainBooking.id);
  } finally {
    for (const row of saved) {
      await pool.query(`UPDATE profiles SET referred_by = $1 WHERE id = $2`, [row.referred_by, row.id]);
    }
  }
}

async function insertPendingBooking(hostId, fees) {
  const { rows: props } = await pool.query(
    `SELECT id FROM properties WHERE host_id = $1 AND is_active = true LIMIT 1`,
    [hostId]
  );
  let propertyId = props[0]?.id;
  if (!propertyId) {
    const created = await pool.query(
      `INSERT INTO properties (
         host_id, title, description, property_type, address, city, state, country,
         bedrooms, bathrooms, max_guests, base_price, cleaning_fee, amenities, images, is_active
       ) VALUES (
         $1, 'Rev-share test listing', 'Automated test property', 'house',
         '1 Test St', 'Testville', 'CA', 'US', 2, 1, 4, 200, 0, '{}', '{}', true
       ) RETURNING id`,
      [hostId]
    );
    propertyId = created.rows[0].id;
  }

  const { rows } = await pool.query(
    `INSERT INTO bookings (
       property_id, guest_id, host_id, guest_user_id, host_user_id,
       check_in, check_out, check_in_date, check_out_date,
       num_guests, total_nights,
       base_amount, cleaning_fee, guest_service_fee, host_service_fee,
       total_amount, host_payout, status, payout_status
     ) VALUES (
       $1, $2, $2, $2, $2,
       CURRENT_DATE + 7, CURRENT_DATE + 10, CURRENT_DATE + 7, CURRENT_DATE + 10,
       2, 3,
       $3, 0, $4, $5, $6, $7, 'pending', 'pending'
     ) RETURNING id`,
    [
      propertyId,
      hostId,
      centsToDollars(fees.subtotalCents),
      centsToDollars(fees.guestServiceFeeCents),
      centsToDollars(fees.hostServiceFeeCents),
      centsToDollars(fees.totalCents),
      centsToDollars(fees.hostPayoutCents),
    ]
  );

  return { id: rows[0].id, propertyId };
}

async function countEarnings(bookingId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM referral_earnings WHERE booking_id = $1`,
    [bookingId]
  );
  return rows[0].count;
}

async function cleanupBooking(bookingId) {
  await pool.query(`DELETE FROM referral_earnings WHERE booking_id = $1`, [bookingId]);
  await pool.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);
}

async function createTestConnectAccount(label) {
  const account = await stripe.accounts.create({
    type: 'custom',
    country: 'US',
    email: `stayloop-${label}-${Date.now()}@example.com`,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    business_profile: { mcc: '7011', url: 'https://stayloop.test' },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
    external_account: {
      object: 'bank_account',
      country: 'US',
      currency: 'usd',
      account_number: '000123456789',
      routing_number: '110000000',
    },
    individual: {
      first_name: 'Test',
      last_name: label,
      dob: { day: 1, month: 1, year: 1990 },
      address: {
        line1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94111',
        country: 'US',
      },
      ssn_last_4: '0000',
      email: `stayloop-${label}@example.com`,
      phone: '0000000000',
    },
    metadata: { stayloop_test: label },
  });

  const refreshed = await stripe.accounts.retrieve(account.id);
  const transfersReady = refreshed.capabilities?.transfers === 'active';
  if (!transfersReady) {
    throw new Error(`Test Connect account ${account.id} missing transfers capability`);
  }

  return refreshed;
}

const STRIPE_TEST_RETURN_URL =
  process.env.STRIPE_TEST_RETURN_URL || 'https://example.com/checkout/complete';

async function createConfirmedTestPayment({ amount, applicationFeeCents, destination, metadata }) {
  return stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    application_fee_amount: applicationFeeCents,
    transfer_data: { destination },
    payment_method_types: ['card'],
    payment_method: 'pm_card_visa',
    confirm: true,
    return_url: STRIPE_TEST_RETURN_URL,
    metadata,
  });
}

async function seedPlatformBalance(amountCents) {
  await stripe.charges.create({
    amount: amountCents,
    currency: 'usd',
    source: 'tok_bypassPending',
    metadata: { stayloop_test: 'platform-balance-seed' },
  });
}

async function resolveTestHostAccountId() {
  if (process.env.STRIPE_TEST_HOST_ACCOUNT_ID) {
    return { accountId: process.env.STRIPE_TEST_HOST_ACCOUNT_ID, source: 'env' };
  }

  const account = await createTestConnectAccount('listing-host');
  console.log(`  ℹ Created ephemeral Custom Connect account ${account.id} (test mode — no Express UI needed)`);
  return { accountId: account.id, source: 'ephemeral' };
}

async function runStripeTest() {
  console.log('\n=== Stripe payment + confirm (optional) ===');

  if (!stripe) {
    fail('Stripe client', 'STRIPE_SECRET_KEY missing');
    return;
  }

  const { accountId: hostAccountId, source } = await resolveTestHostAccountId();
  const account = await stripe.accounts.retrieve(hostAccountId);
  assert(
    account.capabilities?.transfers === 'active',
    'Test host Connect account can receive destination transfers',
    `transfers=${account.capabilities?.transfers}`
  );
  if (source === 'env' && !account.charges_enabled) {
    console.log('  ℹ Express accounts may show charges_enabled=false; destination charges only need transfers.');
  }

  const hosts = await pickHosts();
  const listingHost = hosts.find((h) => h.email?.includes('playpark')) || hosts[0];
  await pool.query(
    `UPDATE profiles
     SET stripe_account_id = $1,
         stripe_charges_enabled = true,
         stripe_payouts_enabled = $2,
         stripe_onboarding_complete = true
     WHERE id = $3`,
    [hostAccountId, account.payouts_enabled, listingHost.id]
  );

  const { rows: props } = await pool.query(
    `SELECT id FROM properties WHERE host_id = $1 LIMIT 1`,
    [listingHost.id]
  );
  if (!props[0]) {
    fail('Test property', 'No property for listing host');
    return;
  }

  const fees = calculateFeesFromTaxable(500, 50, 0);
  const paymentIntent = await createConfirmedTestPayment({
    amount: fees.totalCents,
    applicationFeeCents: fees.applicationFeeCents,
    destination: hostAccountId,
    metadata: { test: 'stayloop-revshare-script' },
  });

  assert(paymentIntent.status === 'succeeded', 'Test PaymentIntent succeeded');

  const { rows } = await pool.query(
    `INSERT INTO bookings (
       property_id, guest_id, host_id, guest_user_id, host_user_id,
       check_in, check_out, check_in_date, check_out_date,
       num_guests, total_nights,
       base_amount, cleaning_fee, guest_service_fee, host_service_fee,
       total_amount, host_payout, status,
       stripe_payment_intent_id, total_amount_cents, platform_fee_amount, payout_status
     ) VALUES (
       $1, $2, $2, $2, $2,
       CURRENT_DATE + 14, CURRENT_DATE + 17, CURRENT_DATE + 14, CURRENT_DATE + 17,
       2, 3,
       500, 50, $3, $4, $5, $6, 'pending',
       $7, $8, $9, 'pending'
     ) RETURNING id`,
    [
      props[0].id,
      listingHost.id,
      centsToDollars(fees.guestServiceFeeCents),
      centsToDollars(fees.hostServiceFeeCents),
      centsToDollars(fees.totalCents),
      centsToDollars(fees.hostPayoutCents),
      paymentIntent.id,
      fees.totalCents,
      fees.applicationFeeCents,
    ]
  );

  const result = await finalizeBookingPayment(paymentIntent.id);
  assert(Boolean(result.bookingId), 'finalizeBookingPayment confirmed booking');
  assert(result.payouts.length === 0, 'No upstream referrers → zero Stripe referrer transfers');
  console.log(`    Stripe PI ${paymentIntent.id} | booking ${result.bookingId} | platform fee ${fees.applicationFeeCents}¢ | host transfer ${fees.hostPayoutCents}¢`);

  await cleanupBooking(rows[0].id);
}

async function runStripeReferralTest() {
  console.log('\n=== Stripe referral transfer chain (optional) ===');

  if (!stripe) {
    fail('Stripe client', 'STRIPE_SECRET_KEY missing');
    return;
  }

  const hosts = await pickHosts();
  const [hostA, hostB, hostC] = hosts;
  const saved = hosts.map((h) => ({
    id: h.id,
    referred_by: h.referred_by,
    stripe_account_id: null,
    stripe_charges_enabled: null,
  }));

  const savedStripe = await pool.query(
    `SELECT id, stripe_account_id, stripe_charges_enabled FROM profiles WHERE id = ANY($1::uuid[])`,
    [hosts.map((h) => h.id)]
  );
  for (const row of savedStripe.rows) {
    const entry = saved.find((s) => s.id === row.id);
    if (entry) {
      entry.stripe_account_id = row.stripe_account_id;
      entry.stripe_charges_enabled = row.stripe_charges_enabled;
    }
  }

  const acctA = await createTestConnectAccount('referrer-a');
  const acctB = await createTestConnectAccount('referrer-b');
  const acctC = await createTestConnectAccount('listing-host-chain');

  const fees = calculateFeesFromTaxable(1000, 0, 2);
  await seedPlatformBalance(fees.referralPoolCents + 5000);

  try {
    await pool.query(`UPDATE profiles SET referred_by = NULL WHERE id = $1`, [hostA.id]);
    await pool.query(`UPDATE profiles SET referred_by = $1 WHERE id = $2`, [hostA.id, hostB.id]);
    await pool.query(`UPDATE profiles SET referred_by = $1 WHERE id = $2`, [hostB.id, hostC.id]);

    for (const [host, acct] of [
      [hostA, acctA],
      [hostB, acctB],
      [hostC, acctC],
    ]) {
      await pool.query(
        `UPDATE profiles
         SET stripe_account_id = $1, stripe_charges_enabled = true, stripe_payouts_enabled = true, stripe_onboarding_complete = true
         WHERE id = $2`,
        [acct.id, host.id]
      );
    }

    const paymentIntent = await createConfirmedTestPayment({
      amount: fees.totalCents,
      applicationFeeCents: fees.applicationFeeCents,
      destination: acctC.id,
      metadata: { test: 'stayloop-referral-chain' },
    });
    assert(paymentIntent.status === 'succeeded', 'Chain test PaymentIntent succeeded');

    const { rows: props } = await pool.query(`SELECT id FROM properties WHERE host_id = $1 LIMIT 1`, [hostC.id]);
    const propertyId = props[0]?.id || (await insertPendingBooking(hostC.id, fees)).propertyId;

    const { rows } = await pool.query(
      `INSERT INTO bookings (
         property_id, guest_id, host_id, guest_user_id, host_user_id,
         check_in, check_out, check_in_date, check_out_date,
         num_guests, total_nights,
         base_amount, cleaning_fee, guest_service_fee, host_service_fee,
         total_amount, host_payout, status,
         stripe_payment_intent_id, total_amount_cents, platform_fee_amount, payout_status
       ) VALUES (
         $1, $2, $2, $2, $2,
         CURRENT_DATE + 21, CURRENT_DATE + 24, CURRENT_DATE + 21, CURRENT_DATE + 24,
         2, 3,
         1000, 0, $3, $4, $5, $6, 'pending',
         $7, $8, $9, 'pending'
       ) RETURNING id`,
      [
        propertyId,
        hostC.id,
        centsToDollars(fees.guestServiceFeeCents),
        centsToDollars(fees.hostServiceFeeCents),
        centsToDollars(fees.totalCents),
        centsToDollars(fees.hostPayoutCents),
        paymentIntent.id,
        fees.totalCents,
        fees.applicationFeeCents,
      ]
    );

    const result = await finalizeBookingPayment(paymentIntent.id);
    assert(Boolean(result.bookingId), 'Chain booking confirmed');
    assert(result.payouts.length === 2, 'Two upstream referrers → two Stripe transfers');
    assert(result.payouts.every((p) => p.status === 'paid'), 'Referrer transfers marked paid');

    const paid = await pool.query(
      `SELECT referral_level, commission_amount, payout_amount, status, stripe_transfer_id
       FROM referral_earnings WHERE booking_id = $1 ORDER BY referral_level`,
      [result.bookingId]
    );
    assert(paid.rows.length === 2, 'Two referral_earnings rows in DB');
    assert(paid.rows.every((r) => r.stripe_transfer_id), 'stripe_transfer_id recorded on earnings');
    assert(Math.abs(Number(paid.rows[0].payout_amount) - 10) < 0.01, 'Level 1 Stripe transfer uses net payout ($10)');
    assert(Math.abs(Number(paid.rows[1].payout_amount) - 10) < 0.01, 'Level 2 Stripe transfer uses net payout ($10)');

    console.log(
      `    PI ${paymentIntent.id} | L1 $${paid.rows[0].payout_amount} → ${acctB.id} | L2 $${paid.rows[1].payout_amount} → ${acctA.id}`
    );

    await cleanupBooking(rows[0].id);
  } finally {
    for (const row of saved) {
      await pool.query(
        `UPDATE profiles
         SET referred_by = $1,
             stripe_account_id = $2,
             stripe_charges_enabled = COALESCE($3, false)
         WHERE id = $4`,
        [row.referred_by, row.stripe_account_id, row.stripe_charges_enabled, row.id]
      );
    }
  }
}

async function main() {
  console.log('StayLoop rev-share test runner');

  if (runFees) {
    console.log('\n=== Fee math (single source of truth) ===');
    feeScenario('No upstream referrers', 1000, 0);
    feeScenario('One upstream referrer', 1000, 1);
    feeScenario('Two upstream referrers', 1000, 2);
    feeScenario('Full three-level chain', 1000, 3);
  }

  if (runDb) await runDbTests();
  if (runStripe) await runStripeTest();
  if (runStripeReferrals) await runStripeReferralTest();

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
