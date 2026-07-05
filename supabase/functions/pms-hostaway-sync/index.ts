import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getHostawayToken, HOSTAWAY_API_BASE, type PMSConnectionRow } from '../_shared/pms-auth.ts';

/*
  Hostaway inbound sync (PMS -> StayLoop): listings, reservations, calendar.
  Auth per host is OAuth client_credentials (Account ID + API Key).
*/

interface SyncRequest {
  action: 'sync_properties' | 'sync_bookings' | 'sync_availability' | 'sync_all' | 'webhook' | 'test_hostaway';
  pmsConnectionId: string;
  listingId?: string;
  webhookData?: unknown;
}

const AVAILABILITY_DAYS = 365;

function getServiceRoleKey(): string | undefined {
  return (
    Deno.env.get('STAYLOOP_SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    undefined
  );
}

function createServiceSupabaseClient() {
  const supabaseUrl = Deno.env.get('STAYLOOP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or service role key.');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

function isServiceRoleRequest(req: Request): boolean {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return false;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const apiKey = req.headers.get('apikey') ?? '';
  return token === serviceRoleKey || apiKey === serviceRoleKey;
}

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>;

function dateOnly(value: unknown): string {
  return String(value ?? '').slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function hostawayFetch(token: string, path: string, init?: RequestInit): Promise<AnyRecord> {
  const url = path.startsWith('http') ? path : `${HOSTAWAY_API_BASE}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Hostaway API error (${response.status}): ${body || response.statusText}`);
  }
  return response.json();
}

function mapHostawayListing(listing: AnyRecord, connection: PMSConnectionRow) {
  const images: string[] = Array.isArray(listing.listingImages)
    ? listing.listingImages
        .map((img: AnyRecord) => img.url || img.originalUrl)
        .filter((url: unknown): url is string => typeof url === 'string')
    : [];

  return {
    host_id: connection.user_id,
    title: listing.name || listing.internalListingName || 'Hostaway Listing',
    description: listing.description || '',
    property_type: 'apartment',
    address: listing.address || '',
    city: listing.city || '',
    state: listing.state || '',
    country: listing.countryCode || listing.country || 'US',
    postal_code: listing.zipcode || null,
    latitude: typeof listing.lat === 'number' ? listing.lat : null,
    longitude: typeof listing.lng === 'number' ? listing.lng : null,
    bedrooms: Number(listing.bedroomsNumber) || 1,
    bathrooms: Number(listing.bathroomsNumber) || 1,
    max_guests: Number(listing.personCapacity) || 2,
    base_price: Number(listing.price) || 0,
    cleaning_fee: Number(listing.cleaningFee) || 0,
    images,
    is_active: listing.status !== 'inactive',
    pms_integration: {
      provider: 'hostaway',
      listing_id: String(listing.id),
      last_synced: new Date().toISOString(),
    },
  };
}

async function syncProperties(supabase: AnyRecord, connection: PMSConnectionRow, token: string) {
  const data = await hostawayFetch(token, '/listings?limit=100');
  const listings: AnyRecord[] = data.result || [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const listing of listings) {
    processed++;
    try {
      const pmsPropertyId = String(listing.id);
      const { data: mapping } = await supabase
        .from('pms_property_mappings')
        .select('id, stayloop_property_id')
        .eq('pms_connection_id', connection.id)
        .eq('pms_property_id', pmsPropertyId)
        .maybeSingle();

      const propertyData = mapHostawayListing(listing, connection);

      if (mapping) {
        await supabase.from('properties').update(propertyData).eq('id', mapping.stayloop_property_id);
        await supabase
          .from('pms_property_mappings')
          .update({ pms_property_data: listing, last_synced_at: new Date().toISOString() })
          .eq('id', mapping.id);
      } else {
        const { data: newProperty, error } = await supabase
          .from('properties')
          .insert(propertyData)
          .select()
          .single();
        if (error || !newProperty) throw error || new Error('Failed to create property');
        await supabase.from('pms_property_mappings').insert({
          pms_connection_id: connection.id,
          stayloop_property_id: newProperty.id,
          pms_property_id: pmsPropertyId,
          pms_property_data: listing,
          last_synced_at: new Date().toISOString(),
        });
      }
      succeeded++;
    } catch (error) {
      console.error(`Failed to sync Hostaway listing ${listing.id}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncAvailability(
  supabase: AnyRecord,
  connection: PMSConnectionRow,
  token: string,
  listingId: string
) {
  const { data: mapping } = await supabase
    .from('pms_property_mappings')
    .select('stayloop_property_id')
    .eq('pms_connection_id', connection.id)
    .eq('pms_property_id', listingId)
    .maybeSingle();

  if (!mapping) throw new Error('Property mapping not found');

  const start = formatDate(new Date());
  const end = formatDate(addDays(new Date(), AVAILABILITY_DAYS));
  const data = await hostawayFetch(
    token,
    `/listings/${listingId}/calendar?startDate=${start}&endDate=${end}`
  );
  const days: AnyRecord[] = data.result || [];
  const syncedAt = new Date().toISOString();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const day of days) {
    processed++;
    try {
      await supabase.from('availability_calendar').upsert(
        {
          property_id: mapping.stayloop_property_id,
          date: dateOnly(day.date),
          is_available: Number(day.isAvailable) === 1 || day.isAvailable === true,
          price_override: day.price != null ? Number(day.price) : null,
          min_nights_override: day.minimumStay != null ? Number(day.minimumStay) : null,
          source: 'hostaway',
          synced_at: syncedAt,
        },
        { onConflict: 'property_id,date' }
      );
      succeeded++;
    } catch (error) {
      console.error(`Failed to sync Hostaway calendar ${day.date}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncBookings(supabase: AnyRecord, connection: PMSConnectionRow, token: string) {
  const data = await hostawayFetch(token, '/reservations?limit=100');
  const reservations: AnyRecord[] = data.result || [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const reservation of reservations) {
    processed++;
    try {
      const listingId = String(reservation.listingMapId ?? reservation.listingId ?? '');
      const { data: mapping } = await supabase
        .from('pms_property_mappings')
        .select('stayloop_property_id')
        .eq('pms_connection_id', connection.id)
        .eq('pms_property_id', listingId)
        .maybeSingle();
      if (!mapping) {
        failed++;
        continue;
      }

      // Skip reservations that originated from StayLoop to avoid echo loops.
      if (String(reservation.channelId) === '2020' && /stayloop/i.test(String(reservation.source ?? ''))) {
        succeeded++;
        continue;
      }

      const { data: property } = await supabase
        .from('properties')
        .select('host_id')
        .eq('id', mapping.stayloop_property_id)
        .single();

      const { data: existing } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', mapping.stayloop_property_id)
        .eq('payment_intent_id', String(reservation.id))
        .maybeSingle();

      if (!existing) {
        const total = Number(reservation.totalPrice) || 0;
        const checkIn = dateOnly(reservation.arrivalDate);
        const checkOut = dateOnly(reservation.departureDate);
        const nights = Math.max(
          1,
          Math.round(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        await supabase.from('bookings').insert({
          property_id: mapping.stayloop_property_id,
          guest_id: connection.user_id,
          host_id: property.host_id,
          check_in: checkIn,
          check_out: checkOut,
          num_guests: Number(reservation.numberOfGuests) || 1,
          total_nights: nights,
          base_amount: total,
          total_amount: total,
          host_payout: Number((total * 0.9).toFixed(2)),
          status: String(reservation.status) === 'cancelled' ? 'cancelled' : 'confirmed',
          payment_intent_id: String(reservation.id),
        });
      }
      succeeded++;
    } catch (error) {
      console.error(`Failed to sync Hostaway reservation ${reservation.id}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncAll(supabase: AnyRecord, connection: PMSConnectionRow, token: string) {
  const properties = await syncProperties(supabase, connection, token);

  const { data: mappings } = await supabase
    .from('pms_property_mappings')
    .select('pms_property_id, auto_sync_enabled')
    .eq('pms_connection_id', connection.id);

  let calendarsSucceeded = 0;
  let calendarsFailed = 0;
  for (const mapping of mappings || []) {
    if (mapping.auto_sync_enabled === false) continue;
    try {
      await syncAvailability(supabase, connection, token, String(mapping.pms_property_id));
      calendarsSucceeded++;
    } catch (error) {
      console.error(`Hostaway calendar sync failed for ${mapping.pms_property_id}:`, error);
      calendarsFailed++;
    }
  }

  const bookings = await syncBookings(supabase, connection, token);

  return {
    processed: properties.processed,
    succeeded: properties.succeeded,
    failed: properties.failed,
    calendars: { succeeded: calendarsSucceeded, failed: calendarsFailed },
    bookings,
  };
}

async function handleWebhook(
  supabase: AnyRecord,
  connection: PMSConnectionRow,
  token: string,
  webhookData: AnyRecord
) {
  await supabase.from('pms_webhook_events').insert({
    pms_connection_id: connection.id,
    event_type: String(webhookData?.event ?? webhookData?.type ?? 'unknown'),
    event_data: webhookData,
    processed: true,
    processed_at: new Date().toISOString(),
  });

  const event = String(webhookData?.event ?? webhookData?.type ?? '').toLowerCase();
  if (event.includes('reservation')) {
    return syncBookings(supabase, connection, token);
  }
  return syncAll(supabase, connection, token);
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { action, pmsConnectionId, listingId, webhookData }: SyncRequest = await req.json();

    if (action === 'webhook' && !isServiceRoleRequest(req)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook processing requires internal authorization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let authedUserId: string | null = null;
    if (action !== 'webhook' && !isServiceRoleRequest(req)) {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authedUserId = userData.user.id;
    }

    let connectionQuery = supabase
      .from('pms_connections')
      .select('*')
      .eq('id', pmsConnectionId)
      .eq('pms_provider', 'hostaway');
    if (authedUserId) connectionQuery = connectionQuery.eq('user_id', authedUserId);

    const { data: connection, error: connError } = await connectionQuery.single();
    if (connError || !connection) throw new Error('PMS connection not found');

    const token = await getHostawayToken(supabase, connection as PMSConnectionRow);

    let syncLogId: string | null = null;
    if (action !== 'test_hostaway') {
      const { data: syncLog } = await supabase
        .from('pms_sync_logs')
        .insert({
          pms_connection_id: pmsConnectionId,
          sync_type: action === 'sync_all' ? 'full' : action.replace('sync_', ''),
          sync_direction: 'from_pms',
          status: 'started',
        })
        .select()
        .single();
      syncLogId = syncLog?.id ?? null;
    }

    let result: AnyRecord;
    switch (action) {
      case 'test_hostaway': {
        const data = await hostawayFetch(token, '/listings?limit=1');
        result = { processed: 0, succeeded: 0, failed: 0, listingCount: data.count ?? (data.result?.length ?? 0) };
        break;
      }
      case 'sync_properties':
        result = await syncProperties(supabase, connection as PMSConnectionRow, token);
        break;
      case 'sync_bookings':
        result = await syncBookings(supabase, connection as PMSConnectionRow, token);
        break;
      case 'sync_availability':
        if (!listingId) throw new Error('listingId required for availability sync');
        result = await syncAvailability(supabase, connection as PMSConnectionRow, token, listingId);
        break;
      case 'sync_all':
        result = await syncAll(supabase, connection as PMSConnectionRow, token);
        break;
      case 'webhook':
        result = await handleWebhook(
          supabase,
          connection as PMSConnectionRow,
          token,
          (webhookData ?? {}) as AnyRecord
        );
        break;
      default:
        throw new Error('Invalid action');
    }

    if (syncLogId) {
      await supabase
        .from('pms_sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: result.processed || 0,
          records_succeeded: result.succeeded || 0,
          records_failed: result.failed || 0,
        })
        .eq('id', syncLogId);
    }

    await supabase
      .from('pms_connections')
      .update({ last_sync_at: new Date().toISOString(), sync_status: 'completed' })
      .eq('id', pmsConnectionId);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Hostaway sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
