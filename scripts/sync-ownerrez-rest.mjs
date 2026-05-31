#!/usr/bin/env node
/**
 * Sync calendar, cancellation policies (via bookings), and reviews from OwnerRez.
 * Pull-only — never writes to OwnerRez.
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

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function getHostAccessToken(hostUserId) {
  const { data: profile } = await admin.from('profiles').select('email').eq('id', hostUserId).maybeSingle();
  const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email: profile.email });
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: otpData } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });
  return otpData.session.access_token;
}

async function invoke(accessToken, action, extra = {}) {
  const started = Date.now();
  const response = await fetch(`${url}/functions/v1/pms-ownerrez-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ action, pmsConnectionId: connectionId, ...extra }),
  });
  const body = JSON.parse(await response.text());
  return { action, status: response.status, elapsedMs: Date.now() - started, body };
}

async function audit() {
  const { data: mappings } = await admin
    .from('pms_property_mappings')
    .select('pms_property_id, stayloop_property_id')
    .eq('pms_connection_id', connectionId);
  const ids = (mappings || []).map((m) => m.stayloop_property_id);

  console.log('\n── Calendar + cancellation audit ──');
  for (const mapping of mappings || []) {
    const { data: property } = await admin
      .from('properties')
      .select('title, cancellation_policy')
      .eq('id', mapping.stayloop_property_id)
      .maybeSingle();
    const { count: nights } = await admin
      .from('availability_calendar')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', mapping.stayloop_property_id);
    const { count: available } = await admin
      .from('availability_calendar')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', mapping.stayloop_property_id)
      .eq('is_available', true);
    console.log(
      JSON.stringify({
        pmsPropertyId: mapping.pms_property_id,
        title: property?.title?.slice(0, 45),
        calendarNights: nights || 0,
        availableNights: available || 0,
        cancellationPolicy: property?.cancellation_policy?.slice(0, 80) || null,
      })
    );
  }

  const { count: reviewCount } = await admin
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('external_pms_provider', 'ownerrez')
    .in('property_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const { data: sampleReviews } = await admin
    .from('reviews')
    .select('property_id, rating, comment, review_source, external_pms_review_id, booking_id')
    .eq('external_pms_provider', 'ownerrez')
    .in('property_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    .order('synced_at', { ascending: false })
    .limit(5);

  console.log('\n── Reviews audit ──');
  console.log(`Imported OwnerRez reviews: ${reviewCount || 0}`);
  for (const review of sampleReviews || []) {
    console.log(
      JSON.stringify({
        externalId: review.external_pms_review_id,
        rating: review.rating,
        source: review.review_source,
        linkedBooking: Boolean(review.booking_id),
        comment: review.comment?.slice(0, 100),
      })
    );
  }
}

async function main() {
  console.log('OwnerRez rest sync: calendar, cancellation policies, reviews\n');
  const { data: connection } = await admin
    .from('pms_connections')
    .select('user_id, account_name')
    .eq('id', connectionId)
    .single();
  console.log(`Account: ${connection.account_name}`);

  const accessToken = await getHostAccessToken(connection.user_id);
  const { data: mappings } = await admin
    .from('pms_property_mappings')
    .select('pms_property_id')
    .eq('pms_connection_id', connectionId);

  console.log('\n── Calendar sync (per property) ──');
  for (const mapping of mappings || []) {
    const result = await invoke(accessToken, 'sync_availability', {
      propertyId: String(mapping.pms_property_id),
    });
    console.log(
      `Property ${mapping.pms_property_id}: HTTP ${result.status} in ${result.elapsedMs}ms`,
      result.body?.success ? result.body.result : result.body?.error
    );
    if (!result.body?.success) throw new Error(result.body?.error || 'Calendar sync failed');
  }

  console.log('\n── Bookings + cancellation policies (per property) ──');
  for (const mapping of mappings || []) {
    const result = await invoke(accessToken, 'sync_bookings', {
      propertyId: String(mapping.pms_property_id),
    });
    console.log(
      `Bookings ${mapping.pms_property_id}: HTTP ${result.status} in ${result.elapsedMs}ms`,
      result.body?.success ? result.body.result : result.body?.error
    );
    if (!result.body?.success) throw new Error(result.body?.error || 'Booking sync failed');
  }

  console.log('\n── Reviews sync (all properties) ──');
  const reviewResult = await invoke(accessToken, 'sync_reviews');
  console.log(`Reviews: HTTP ${reviewResult.status} in ${reviewResult.elapsedMs}ms`);
  console.log(JSON.stringify(reviewResult.body, null, 2));
  if (!reviewResult.body?.success) throw new Error(reviewResult.body?.error || 'Review sync failed');

  await audit();
  console.log('\nDone.');
}

main().catch((error) => {
  console.error('\nFailed:', error.message || error);
  process.exit(1);
});
