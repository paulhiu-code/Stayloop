import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface OwnerRezProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  baseRate: number;
  description: string;
  amenities: string[];
  photos: string[];
}

interface SyncRequest {
  action: 'sync_properties' | 'sync_bookings' | 'sync_availability' | 'webhook';
  pmsConnectionId: string;
  propertyId?: string;
  webhookData?: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('STAYLOOP_SUPABASE_URL')!,
      Deno.env.get('STAYLOOP_SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, pmsConnectionId, propertyId, webhookData }: SyncRequest = await req.json();

    let authedUserId: string | null = null;
    if (action !== 'webhook') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Not authenticated' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      authedUserId = userData.user.id;
    }

    // Get PMS connection details
    let connectionQuery = supabase
      .from('pms_connections')
      .select('*')
      .eq('id', pmsConnectionId)
      .eq('pms_provider', 'ownerrez');

    if (authedUserId) {
      connectionQuery = connectionQuery.eq('user_id', authedUserId);
    }

    const { data: connection, error: connError } = await connectionQuery.single();

    if (connError || !connection) {
      throw new Error('PMS connection not found');
    }

    const ownerRezToken = connection.oauth_access_token || connection.api_credentials?.access_token;
    if (!ownerRezToken) {
      throw new Error('OwnerRez access token is missing');
    }
    const baseUrl = 'https://api.ownerreservations.com/v2';

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
        result = await syncProperties(supabase, connection, baseUrl, ownerRezToken);
        break;
      case 'sync_bookings':
        result = await syncBookings(supabase, connection, baseUrl, ownerRezToken, propertyId);
        break;
      case 'sync_availability':
        result = await syncAvailability(supabase, connection, baseUrl, ownerRezToken, propertyId);
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
    console.error('OwnerRez sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncProperties(supabase: any, connection: any, baseUrl: string, token: string) {
  const response = await fetch(`${baseUrl}/properties`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OwnerRez API error: ${response.statusText}`);
  }

  const properties = await response.json();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const prop of properties) {
    processed++;
    try {
      // Check if mapping exists
      const { data: mapping } = await supabase
        .from('pms_property_mappings')
        .select('id, stayloop_property_id')
        .eq('pms_connection_id', connection.id)
        .eq('pms_property_id', prop.id)
        .maybeSingle();

      const propertyData = {
        host_id: connection.user_id,
        title: prop.name,
        description: prop.description || '',
        property_type: 'house',
        address: prop.address || '',
        city: prop.city || '',
        state: prop.state || '',
        country: prop.country || 'US',
        bedrooms: prop.bedrooms || 1,
        bathrooms: prop.bathrooms || 1,
        max_guests: prop.maxGuests || 2,
        base_price: prop.baseRate || 0,
        cleaning_fee: 0,
        amenities: prop.amenities || [],
        images: prop.photos || [],
        pms_integration: {
          provider: 'ownerrez',
          property_id: prop.id,
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
            pms_property_data: prop,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', mapping.id);
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
            pms_property_id: prop.id,
            pms_property_data: prop,
            last_synced_at: new Date().toISOString(),
          });
      }

      succeeded++;
    } catch (error) {
      console.error(`Failed to sync property ${prop.id}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncBookings(supabase: any, connection: any, baseUrl: string, token: string, propertyId?: string) {
  const url = propertyId
    ? `${baseUrl}/properties/${propertyId}/bookings`
    : `${baseUrl}/bookings`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OwnerRez API error: ${response.statusText}`);
  }

  const bookings = await response.json();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const booking of bookings) {
    processed++;
    try {
      // Get property mapping
      const { data: mapping } = await supabase
        .from('pms_property_mappings')
        .select('id, stayloop_property_id')
        .eq('pms_connection_id', connection.id)
        .eq('pms_property_id', booking.propertyId)
        .maybeSingle();

      if (!mapping) {
        console.log(`Property mapping not found for booking ${booking.id}`);
        failed++;
        continue;
      }

      // Get property to get host_id
      const { data: property } = await supabase
        .from('properties')
        .select('host_id')
        .eq('id', mapping.stayloop_property_id)
        .single();

      // Check if booking already exists
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', mapping.stayloop_property_id)
        .eq('payment_intent_id', booking.id)
        .maybeSingle();

      if (!existingBooking) {
        const total = Number(booking.total || 0);
        const cleaningFee = Number(booking.cleaningFee || 0);
        const guestServiceFee = Number((total * 0.05).toFixed(2));
        const hostServiceFee = Number((total * 0.10).toFixed(2));

        await supabase.from('bookings').insert({
          property_id: mapping.stayloop_property_id,
          guest_id: connection.user_id,
          host_id: property.host_id,
          check_in: booking.arrival,
          check_out: booking.departure,
          num_guests: booking.guests || 1,
          total_nights: booking.nights || 1,
          base_amount: total,
          cleaning_fee: cleaningFee,
          guest_service_fee: guestServiceFee,
          host_service_fee: hostServiceFee,
          total_amount: total + guestServiceFee,
          host_payout: total - hostServiceFee,
          status: booking.status === 'confirmed' ? 'confirmed' : 'pending',
          payment_intent_id: booking.id,
        });
      }

      succeeded++;
    } catch (error) {
      console.error(`Failed to sync booking ${booking.id}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncAvailability(supabase: any, connection: any, baseUrl: string, token: string, propertyId?: string) {
  if (!propertyId) {
    throw new Error('Property ID required for availability sync');
  }

  const response = await fetch(`${baseUrl}/properties/${propertyId}/calendar`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OwnerRez API error: ${response.statusText}`);
  }

  const calendar = await response.json();

  // Get property mapping
  const { data: mapping } = await supabase
    .from('pms_property_mappings')
    .select('id, stayloop_property_id')
    .eq('pms_connection_id', connection.id)
    .eq('pms_property_id', propertyId)
    .single();

  if (!mapping) {
    throw new Error('Property mapping not found');
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const day of calendar.days) {
    processed++;
    try {
      await supabase
        .from('availability_calendar')
        .upsert({
          property_id: mapping.stayloop_property_id,
          date: day.date,
          is_available: day.available,
          price_override: day.rate,
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
    case 'booking.created':
    case 'booking.updated':
      // Trigger booking sync
      break;
    case 'property.updated':
      // Trigger property sync
      break;
  }

  return { processed: 1, succeeded: 1, failed: 0 };
}
