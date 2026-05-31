#!/usr/bin/env node
/**
 * Pull-only OwnerRez sync test.
 * Invokes pms-ownerrez-sync for properties, bookings, and calendar — never writes to OwnerRez.
 *
 * Usage: node scripts/test-ownerrez-pull.mjs [pmsConnectionId]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionId = process.argv[2] || '4bbd79b3-5a3a-4742-af3b-4b0ab326b513';

if (!url || !anonKey || !serviceKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getHostAccessToken(hostUserId) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('email')
    .eq('id', hostUserId)
    .maybeSingle();

  if (error || !profile?.email) {
    throw new Error(`Could not resolve host email: ${error?.message || 'missing profile'}`);
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(`Could not generate host session: ${linkError?.message || 'no token'}`);
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: otpData, error: otpError } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });

  if (otpError || !otpData.session?.access_token) {
    throw new Error(`Could not verify host session: ${otpError?.message || 'no session'}`);
  }

  return otpData.session.access_token;
}

async function invokeSync(accessToken, action, extra = {}) {
  const started = Date.now();
  const response = await fetch(`${url}/functions/v1/pms-ownerrez-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({
      action,
      pmsConnectionId: connectionId,
      ...extra,
    }),
  });

  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { raw: bodyText.slice(0, 500) };
  }

  return {
    action,
    status: response.status,
    elapsedMs: Date.now() - started,
    body,
  };
}

async function auditResults() {
  const { data: mappings, error: mapError } = await admin
    .from('pms_property_mappings')
    .select('pms_property_id, stayloop_property_id')
    .eq('pms_connection_id', connectionId);

  if (mapError) throw mapError;

  console.log('\n── Property audit ──');
  for (const mapping of mappings || []) {
    const { data: property } = await admin
      .from('properties')
      .select(
        'title, description, images, amenities, check_in_time, check_out_time, currency_code, timezone, max_pets, external_pms_property_id, synced_at, base_price, cleaning_fee'
      )
      .eq('id', mapping.stayloop_property_id)
      .maybeSingle();

    const { count: calendarCount } = await admin
      .from('availability_calendar')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', mapping.stayloop_property_id);

    const { count: availableCount } = await admin
      .from('availability_calendar')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', mapping.stayloop_property_id)
      .eq('is_available', true);

    console.log(
      JSON.stringify(
        {
          pmsPropertyId: mapping.pms_property_id,
          title: property?.title,
          descriptionLength: (property?.description || '').length,
          imageCount: Array.isArray(property?.images) ? property.images.length : 0,
          amenityCount: Array.isArray(property?.amenities) ? property.amenities.length : 0,
          checkIn: property?.check_in_time,
          checkOut: property?.check_out_time,
          currency: property?.currency_code,
          timezone: property?.timezone,
          maxPets: property?.max_pets,
          externalPmsId: property?.external_pms_property_id,
          basePrice: property?.base_price,
          cleaningFee: property?.cleaning_fee,
          calendarNights: calendarCount || 0,
          availableNights: availableCount || 0,
          syncedAt: property?.synced_at,
        },
        null,
        2
      )
    );
  }

  const propertyIds = (mappings || []).map((m) => m.stayloop_property_id);
  const { data: bookings, error: bookingError } = await admin
    .from('bookings')
    .select(
      'property_id, external_pms_booking_id, guest_name, guest_email, guest_phone, status, booking_source, is_block, check_in, check_out, total_amount'
    )
    .in('property_id', propertyIds.length ? propertyIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('external_pms_provider', 'ownerrez')
    .order('check_in', { ascending: true });

  if (bookingError) throw bookingError;

  console.log('\n── Booking audit ──');
  console.log(`Imported OwnerRez bookings: ${bookings?.length || 0}`);
  for (const booking of (bookings || []).slice(0, 15)) {
    console.log(
      JSON.stringify(
        {
          externalId: booking.external_pms_booking_id,
          guest: booking.guest_name,
          email: booking.guest_email ? 'yes' : 'no',
          phone: booking.guest_phone ? 'yes' : 'no',
          status: booking.status,
          source: booking.booking_source,
          isBlock: booking.is_block,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          total: booking.total_amount,
        },
        null,
        2
      )
    );
  }
  if ((bookings?.length || 0) > 15) {
    console.log(`… and ${bookings.length - 15} more bookings`);
  }

  const { count: mappingCount } = await admin
    .from('pms_booking_mappings')
    .select('*', { count: 'exact', head: true })
    .eq('pms_connection_id', connectionId);

  console.log(`\npms_booking_mappings rows: ${mappingCount || 0}`);
}

async function main() {
  console.log('OwnerRez Pull-Only Sync Test');
  console.log('============================');
  console.log(`Connection: ${connectionId}\n`);

  const { data: connection, error: connError } = await admin
    .from('pms_connections')
    .select('id, account_name, user_id, last_sync_at')
    .eq('id', connectionId)
    .single();

  if (connError || !connection) {
    throw new Error(`Connection not found: ${connError?.message || connectionId}`);
  }

  console.log(`Account: ${connection.account_name}`);
  console.log(`Host user: ${connection.user_id}`);
  console.log(`Last sync: ${connection.last_sync_at || 'never'}\n`);

  const accessToken = await getHostAccessToken(connection.user_id);
  console.log('Host session acquired\n');

  for (const action of ['sync_properties', 'sync_bookings', 'sync_all']) {
    console.log(`── Invoking ${action} ──`);
    const result = await invokeSync(accessToken, action);
    console.log(`HTTP ${result.status} in ${result.elapsedMs}ms`);
    console.log(JSON.stringify(result.body, null, 2));
    if (!result.body?.success) {
      throw new Error(`${action} failed: ${result.body?.error || 'unknown error'}`);
    }
    console.log('');
  }

  await auditResults();
  console.log('\nDone — pull-only sync completed (no OwnerRez writes).');
}

main().catch((error) => {
  console.error('\nTest failed:', error.message || error);
  process.exit(1);
});
