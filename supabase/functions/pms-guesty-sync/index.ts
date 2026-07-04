import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GuestyListing {
  _id: string;
  nickname: string;
  title: string;
  address: {
    full: string;
    city: string;
    state: string;
    country: string;
  };
  accommodates: number;
  bedrooms: number;
  bathrooms: number;
  prices: {
    basePrice: number;
    currency: string;
  };
  publicDescription: {
    summary: string;
  };
  amenities: string[];
  pictures: Array<{ thumbnail: string; original: string }>;
}

interface SyncRequest {
  action: 'sync_properties' | 'sync_bookings' | 'sync_availability' | 'webhook';
  pmsConnectionId: string;
  listingId?: string;
  webhookData?: any;
}

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
  const authHeader = req.headers.get('Authorization') ?? '';
  const apiKeyHeader = req.headers.get('apikey') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === serviceRoleKey || apiKeyHeader === serviceRoleKey;
}

Deno.serve(async (req: Request) => {
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
    if (action !== 'webhook') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
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
      .eq('pms_provider', 'guesty');

    if (authedUserId) {
      connectionQuery = connectionQuery.eq('user_id', authedUserId);
    }

    const { data: connection, error: connError } = await connectionQuery.single();

    if (connError || !connection) {
      throw new Error('PMS connection not found');
    }

    const guestyToken = connection.oauth_access_token;
    const baseUrl = 'https://open-api.guesty.com/v1';

    // Create sync log
    const { data: syncLog } = await supabase
      .from('pms_sync_logs')
      .insert({
        pms_connection_id: pmsConnectionId,
        sync_type: action.replace('sync_', ''),
        sync_direction: 'from_pms',
        status: 'started',
      })
      .select()
      .single();

    let result;

    switch (action) {
      case 'sync_properties':
        result = await syncListings(supabase, connection, baseUrl, guestyToken);
        break;
      case 'sync_bookings':
        result = await syncReservations(supabase, connection, baseUrl, guestyToken, listingId);
        break;
      case 'sync_availability':
        result = await syncCalendar(supabase, connection, baseUrl, guestyToken, listingId);
        break;
      case 'webhook':
        result = await handleWebhook(supabase, connection, webhookData);
        break;
      default:
        throw new Error('Invalid action');
    }

    // Update sync log
    await supabase
      .from('pms_sync_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: result.processed || 0,
        records_succeeded: result.succeeded || 0,
        records_failed: result.failed || 0,
      })
      .eq('id', syncLog.id);

    // Update connection last sync
    await supabase
      .from('pms_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: 'completed',
      })
      .eq('id', pmsConnectionId);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Guesty sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncListings(supabase: any, connection: any, baseUrl: string, token: string) {
  const response = await fetch(`${baseUrl}/listings`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Guesty API error: ${response.statusText}`);
  }

  const data = await response.json();
  const listings = data.results || [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const listing of listings) {
    processed++;
    try {
      // Check if mapping exists
      const { data: mapping } = await supabase
        .from('pms_property_mappings')
        .select('stayloop_property_id')
        .eq('pms_connection_id', connection.id)
        .eq('pms_property_id', listing._id)
        .maybeSingle();

      const images = listing.pictures?.map((pic: any) => pic.original || pic.thumbnail) || [];

      const propertyData = {
        host_id: connection.user_id,
        title: listing.title || listing.nickname,
        description: listing.publicDescription?.summary || '',
        property_type: 'apartment',
        address: listing.address?.full || '',
        city: listing.address?.city || '',
        state: listing.address?.state || '',
        country: listing.address?.country || 'US',
        bedrooms: listing.bedrooms || 1,
        bathrooms: listing.bathrooms || 1,
        max_guests: listing.accommodates || 2,
        base_price: listing.prices?.basePrice || 0,
        amenities: listing.amenities || [],
        images,
        pms_integration: {
          provider: 'guesty',
          listing_id: listing._id,
          last_synced: new Date().toISOString(),
        },
      };

      if (mapping) {
        // Update existing property
        await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', mapping.stayloop_property_id);

        await supabase
          .from('pms_property_mappings')
          .update({
            pms_property_data: listing,
            last_synced_at: new Date().toISOString(),
          })
          .eq('pms_connection_id', connection.id)
          .eq('pms_property_id', listing._id);
      } else {
        // Create new property
        const { data: newProperty } = await supabase
          .from('properties')
          .insert(propertyData)
          .select()
          .single();

        // Create mapping
        await supabase
          .from('pms_property_mappings')
          .insert({
            pms_connection_id: connection.id,
            stayloop_property_id: newProperty.id,
            pms_property_id: listing._id,
            pms_property_data: listing,
            last_synced_at: new Date().toISOString(),
          });
      }

      succeeded++;
    } catch (error) {
      console.error(`Failed to sync listing ${listing._id}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncReservations(supabase: any, connection: any, baseUrl: string, token: string, listingId?: string) {
  const url = listingId
    ? `${baseUrl}/reservations?listingId=${listingId}`
    : `${baseUrl}/reservations`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Guesty API error: ${response.statusText}`);
  }

  const data = await response.json();
  const reservations = data.results || [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const reservation of reservations) {
    processed++;
    try {
      // Get property mapping
      const { data: mapping } = await supabase
        .from('pms_property_mappings')
        .select('stayloop_property_id')
        .eq('pms_connection_id', connection.id)
        .eq('pms_property_id', reservation.listingId)
        .maybeSingle();

      if (!mapping) {
        console.log(`Property mapping not found for reservation ${reservation._id}`);
        failed++;
        continue;
      }

      // Get property to get host_id
      const { data: property } = await supabase
        .from('properties')
        .select('host_id, base_price')
        .eq('id', mapping.stayloop_property_id)
        .single();

      // Check if booking already exists
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', mapping.stayloop_property_id)
        .eq('payment_intent_id', reservation._id)
        .maybeSingle();

      if (!existingBooking) {
        const checkIn = new Date(reservation.checkIn);
        const checkOut = new Date(reservation.checkOut);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const totalAmount = reservation.money?.totalPrice || property.base_price * nights;

        await supabase.from('bookings').insert({
          property_id: mapping.stayloop_property_id,
          guest_id: connection.user_id,
          host_id: property.host_id,
          check_in: reservation.checkIn,
          check_out: reservation.checkOut,
          num_guests: reservation.guestsCount || 1,
          total_nights: nights,
          base_amount: totalAmount,
          total_amount: totalAmount,
          host_payout: totalAmount * 0.9,
          status: reservation.status === 'confirmed' ? 'confirmed' : 'pending',
          payment_intent_id: reservation._id,
        });
      }

      succeeded++;
    } catch (error) {
      console.error(`Failed to sync reservation ${reservation._id}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncCalendar(supabase: any, connection: any, baseUrl: string, token: string, listingId?: string) {
  if (!listingId) {
    throw new Error('Listing ID required for calendar sync');
  }

  // Get next 90 days
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 90);

  const response = await fetch(
    `${baseUrl}/listings/${listingId}/calendar?startDate=${today.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Guesty API error: ${response.statusText}`);
  }

  const calendar = await response.json();

  // Get property mapping
  const { data: mapping } = await supabase
    .from('pms_property_mappings')
    .select('stayloop_property_id')
    .eq('pms_connection_id', connection.id)
    .eq('pms_property_id', listingId)
    .single();

  if (!mapping) {
    throw new Error('Property mapping not found');
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const day of calendar.days || []) {
    processed++;
    try {
      await supabase
        .from('availability_calendar')
        .upsert({
          property_id: mapping.stayloop_property_id,
          date: day.date,
          is_available: day.status === 'available',
          price_override: day.price,
          source: 'guesty',
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'property_id,date',
        });
      succeeded++;
    } catch (error) {
      console.error(`Failed to sync availability for ${day.date}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function handleWebhook(supabase: any, connection: any, webhookData: any) {
  // Log webhook event
  await supabase.from('pms_webhook_events').insert({
    pms_connection_id: connection.id,
    event_type: webhookData.event,
    event_data: webhookData,
  });

  // Process based on event type
  switch (webhookData.event) {
    case 'reservation.created':
    case 'reservation.updated':
      // Trigger reservation sync
      break;
    case 'listing.updated':
      // Trigger listing sync
      break;
  }

  return { processed: 1, succeeded: 1, failed: 0 };
}
