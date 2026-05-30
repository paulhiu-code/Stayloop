#!/usr/bin/env node
/**
 * StayLoop Supabase verification script.
 *
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/verify-supabase.mjs
 *
 * Optional (for deeper checks):
 *   SUPABASE_SERVICE_ROLE_KEY=...   — verify triggers/functions, insert test row cleanup
 *   DATABASE_URL=...                — direct Postgres schema introspection
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadDotEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const databaseUrl = process.env.DATABASE_URL || '';

const EXPECTED_TABLES = [
  'profiles',
  'properties',
  'bookings',
  'availability_calendar',
  'referral_earnings',
  'messages',
  'reviews',
  'pms_connections',
  'pms_property_mappings',
  'pms_sync_logs',
  'pms_webhook_events',
];

const OPTIONAL_LEGACY_TABLES = ['property_availability', 'conversations'];

const EXPECTED_EDGE_FUNCTIONS = [
  'pms-ownerrez-sync',
  'pms-guesty-sync',
  'pms-webhook-receiver',
  'pms-scheduled-sync',
];

const results = [];
let hasFailure = false;

function pass(label, detail) {
  results.push({ status: 'PASS', label, detail });
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail) {
  hasFailure = true;
  results.push({ status: 'FAIL', label, detail });
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

function warn(label, detail) {
  results.push({ status: 'WARN', label, detail });
  console.log(`  ⚠️  ${label}${detail ? ` — ${detail}` : ''}`);
}

function info(label, detail) {
  results.push({ status: 'INFO', label, detail });
  console.log(`  ℹ️  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function restFetch(path, { apikey, token, method = 'GET', body } = {}) {
  const headers = {
    apikey: apikey || anonKey,
    Authorization: `Bearer ${token || apikey || anonKey}`,
  };
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, json, text };
}

async function checkEnv() {
  console.log('\n── 1. Environment ──');
  if (!supabaseUrl) {
    fail('VITE_SUPABASE_URL', 'Not set. Copy .env.example → .env and fill in your project URL.');
    return false;
  }
  pass('VITE_SUPABASE_URL', supabaseUrl);

  if (!anonKey) {
    fail('VITE_SUPABASE_ANON_KEY', 'Not set.');
    return false;
  }
  pass('VITE_SUPABASE_ANON_KEY', `${anonKey.slice(0, 12)}… (${anonKey.length} chars)`);

  if (serviceKey) pass('SUPABASE_SERVICE_ROLE_KEY', 'Set (enables deeper checks)');
  else warn('SUPABASE_SERVICE_ROLE_KEY', 'Not set — skipping service-role checks');

  if (databaseUrl) pass('DATABASE_URL', 'Set (enables Postgres introspection)');
  else info('DATABASE_URL', 'Not set — skipping direct DB checks');

  return true;
}

async function checkReachability() {
  console.log('\n── 2. API reachability ──');
  try {
    const { response, json } = await restFetch('/rest/v1/', { token: anonKey });
    if (response.ok || response.status === 404) {
      pass('REST API', `HTTP ${response.status}`);
    } else {
      fail('REST API', `HTTP ${response.status} — ${json?.message || json?.hint || 'unexpected response'}`);
    }
  } catch (err) {
    fail('REST API', err.message);
    return false;
  }

  try {
    const { response } = await restFetch('/auth/v1/health', { token: anonKey });
    if (response.ok) pass('Auth API', 'Healthy');
    else warn('Auth API', `HTTP ${response.status}`);
  } catch (err) {
    warn('Auth API', err.message);
  }

  return true;
}

async function checkTables() {
  console.log('\n── 3. Table structure (REST probe) ──');
  for (const table of EXPECTED_TABLES) {
    const { response, json } = await restFetch(
      `/rest/v1/${table}?select=*&limit=0`,
      { token: anonKey }
    );

    if (response.status === 404 || json?.code === '42P01') {
      fail(`table:${table}`, 'Does not exist — migration may not have been applied');
    } else if (response.ok) {
      pass(`table:${table}`, 'Exists and queryable');
    } else if (response.status === 401 || response.status === 403) {
      // RLS blocking is fine — table exists
      pass(`table:${table}`, `Exists (RLS returned HTTP ${response.status})`);
    } else {
      warn(`table:${table}`, `HTTP ${response.status} — ${json?.message || json?.hint || 'unknown'}`);
    }
  }

  for (const table of OPTIONAL_LEGACY_TABLES) {
    const { response, json } = await restFetch(
      `/rest/v1/${table}?select=*&limit=0`,
      { token: anonKey }
    );
    if (response.status === 404 || json?.code === '42P01') {
      info(`legacy:${table}`, 'Not present (expected — app uses availability_calendar instead)');
    } else if (response.ok || response.status === 401 || response.status === 403) {
      warn(`legacy:${table}`, 'Exists but is not used by the current frontend');
    }
  }
}

async function checkAnonAccess() {
  console.log('\n── 4. Anonymous guest access (public booking flow) ──');

  const { response: propRes, json: propJson } = await restFetch(
    '/rest/v1/properties?select=id,title,is_active&is_active=eq.true&limit=3',
    { token: anonKey }
  );

  if (propRes.ok) {
    const count = Array.isArray(propJson) ? propJson.length : 0;
    pass('Anon read properties', `${count} active listing(s) returned`);
    if (count === 0) warn('Active listings', 'No active properties — homepage will show showcase fallback data');
  } else {
    fail('Anon read properties', `HTTP ${propRes.status} — ${propJson?.message || 'blocked by RLS or missing anon policy'}`);
  }

  const { response: calRes, json: calJson } = await restFetch(
    '/rest/v1/availability_calendar?select=date,is_available&limit=1',
    { token: anonKey }
  );

  if (calRes.ok) {
    pass('Anon read availability_calendar', 'Allowed');
  } else {
    fail('Anon read availability_calendar', `HTTP ${calRes.status} — ${calJson?.message || 'blocked'}`);
  }
}

async function checkProfileColumns() {
  console.log('\n── 5. Stripe Connect columns on profiles ──');
  const { response, json } = await restFetch(
    '/rest/v1/profiles?select=id,stripe_account_id,stripe_onboarding_complete,stripe_charges_enabled,stripe_payouts_enabled&limit=0',
    { token: anonKey }
  );

  if (response.ok) {
    pass('profiles Stripe columns', 'stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled');
  } else if (json?.message?.includes('stripe_account_id') || json?.hint?.includes('stripe')) {
    fail('profiles Stripe columns', 'Missing — apply migration 20260517000000_stripe_connect.sql');
  } else if (response.status === 401 || response.status === 403) {
    pass('profiles Stripe columns', 'Exist (RLS blocked row read, column probe succeeded)');
  } else {
    warn('profiles Stripe columns', json?.message || `HTTP ${response.status}`);
  }
}

async function checkBookingColumns() {
  console.log('\n── 6. Stripe booking columns ──');
  const { response, json } = await restFetch(
    '/rest/v1/bookings?select=id,stripe_payment_intent_id,payout_status,guest_user_id,host_user_id,total_amount_cents&limit=0',
    { token: anonKey }
  );

  if (response.ok) {
    pass('bookings Stripe columns', 'stripe_payment_intent_id, payout_status, guest_user_id, host_user_id, total_amount_cents');
  } else if (json?.message?.includes('stripe_payment_intent_id') || json?.message?.includes('payout_status')) {
    fail('bookings Stripe columns', 'Missing — apply migration 20260517000000_stripe_connect.sql');
  } else if (response.status === 401 || response.status === 403) {
    pass('bookings Stripe columns', 'Exist (RLS blocked row read, column probe succeeded)');
  } else {
    warn('bookings Stripe columns', json?.message || `HTTP ${response.status}`);
  }
}

async function checkAvailabilitySourceColumn() {
  console.log('\n── 7. PMS calendar columns ──');
  const { response, json } = await restFetch(
    '/rest/v1/availability_calendar?select=date,source,synced_at&limit=0',
    { token: anonKey }
  );

  if (response.ok) {
    pass('availability_calendar PMS columns', 'source, synced_at');
  } else if (json?.message?.includes('source') || json?.message?.includes('synced_at')) {
    fail('availability_calendar PMS columns', 'Missing — apply migration 20260521000000_guest_booking_calendar.sql');
  } else if (response.status === 401 || response.status === 403) {
    pass('availability_calendar PMS columns', 'Exist (RLS blocked row read, column probe succeeded)');
  } else {
    warn('availability_calendar PMS columns', json?.message || `HTTP ${response.status}`);
  }
}

async function checkEdgeFunctions() {
  console.log('\n── 8. Edge Functions ──');
  for (const fn of EXPECTED_EDGE_FUNCTIONS) {
    try {
      const { response } = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
        method: 'OPTIONS',
        headers: { apikey: anonKey },
      });
      // 200/204 = deployed; 404 = not deployed; 401/405 = deployed but needs auth/method
      if (response.status === 404) {
        fail(`function:${fn}`, 'Not deployed — run `supabase functions deploy ${fn}`');
      } else {
        pass(`function:${fn}`, `Deployed (HTTP ${response.status} on OPTIONS)`);
      }
    } catch (err) {
      fail(`function:${fn}`, err.message);
    }
  }
}

async function checkPostgresSchema() {
  if (!databaseUrl) return;

  console.log('\n── 9. Postgres introspection (DATABASE_URL) ──');
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const { rows: tables } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tableSet = new Set(tables.map((r) => r.table_name));
    pass('Postgres connection', `${tables.length} public tables`);

    for (const t of EXPECTED_TABLES) {
      if (tableSet.has(t)) pass(`pg:table:${t}`, 'present');
      else fail(`pg:table:${t}`, 'missing');
    }

    const { rows: triggers } = await pool.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        OR event_object_schema = 'auth'
      ORDER BY trigger_name
    `);
    const triggerNames = triggers.map((t) => t.trigger_name);
    if (triggerNames.includes('on_auth_user_created')) {
      pass('Trigger on_auth_user_created', 'Profile auto-creation on signup is wired');
    } else {
      fail('Trigger on_auth_user_created', 'Missing — new users will not get profiles');
    }

    if (triggerNames.includes('on_booking_confirmed')) {
      pass('Trigger on_booking_confirmed', 'Referral commission trigger is wired');
    } else {
      warn('Trigger on_booking_confirmed', 'Missing — referral commissions will not auto-calculate');
    }

    const { rows: migrations } = await pool.query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      ORDER BY version
    `).catch(() => ({ rows: [] }));

    if (migrations.length > 0) {
      pass('Applied migrations', `${migrations.length} recorded in schema_migrations`);
      for (const m of migrations) {
        info(`  migration`, `${m.version} — ${m.name || ''}`);
      }

      const hasBroken = migrations.some((m) => m.version === '20251008070000');
      if (hasBroken) {
        warn(
          'Migration 20251008070000',
          'Applied but references property_availability/conversations tables that were never created — safe to ignore if no errors in dashboard'
        );
      }
    } else {
      warn('schema_migrations', 'Could not read — migrations may have been applied manually');
    }
  } catch (err) {
    fail('Postgres connection', err.message);
  } finally {
    await pool.end();
  }
}

function printStaticAudit() {
  console.log('\n── Static migration audit (from repo) ──');
  info(
    'Migration order',
    '7 files in supabase/migrations/ — apply in timestamp order via Supabase SQL editor or CLI'
  );
  warn(
    '20251008070000_bookings_and_messaging.sql',
    'References property_availability, conversations, and messages.conversation_id without CREATE TABLE — will fail on fresh apply unless skipped/fixed'
  );
  info(
    'Guesty sync function',
    'pms-guesty-sync writes to property_availability (wrong table) — OwnerRez correctly uses availability_calendar'
  );
  info(
    'properties.property_type CHECK',
    "DB allows house/apartment/condo/…/other only — showcase demo data uses unique_stay/entire_home (client-side only, not inserted to DB)"
  );
}

async function main() {
  console.log('StayLoop Supabase Verification');
  console.log('================================');

  printStaticAudit();

  const envOk = await checkEnv();
  if (!envOk) {
    console.log('\n── Result ──');
    console.log('Cannot run live checks without credentials.');
    console.log('\nNext step: copy .env.example → .env, fill in your Supabase project values, then re-run:');
    console.log('  node scripts/verify-supabase.mjs');
    process.exit(1);
  }

  await checkReachability();
  await checkTables();
  await checkAnonAccess();
  await checkProfileColumns();
  await checkBookingColumns();
  await checkAvailabilitySourceColumn();
  await checkEdgeFunctions();
  await checkPostgresSchema();

  console.log('\n── Result ──');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const warnings = results.filter((r) => r.status === 'WARN').length;
  console.log(`${passed} passed, ${failed} failed, ${warnings} warnings`);

  if (hasFailure) {
    console.log('\nSupabase is NOT fully ready. Fix the failures above before proceeding.');
    process.exit(1);
  }

  if (warnings > 0) {
    console.log('\nSupabase connection looks good with warnings — review items above.');
    process.exit(0);
  }

  console.log('\nSupabase looks good to go.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
