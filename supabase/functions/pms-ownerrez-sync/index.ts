import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const OWNERREZ_API_BASE = 'https://api.ownerrez.com/v2';

interface SyncRequest {
  action: 'sync_properties' | 'sync_bookings' | 'sync_availability' | 'webhook';
  pmsConnectionId: string;
  propertyId?: string;
  webhookData?: any;
}

function getOwnerRezEmail(connection: Record<string, unknown>): string | null {
  const credentials = connection.api_credentials as Record<string, unknown> | null;
  const email = credentials?.ownerrez_email ?? credentials?.email;
  return typeof email === 'string' && email.includes('@') ? email : null;
}


function createServiceSupabaseClient() {
  const supabaseUrl = Deno.env.get('STAYLOOP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
  const serviceRoleKey =
    Deno.env.get('STAYLOOP_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase secrets. Add STAYLOOP_SUPABASE_URL and STAYLOOP_SUPABASE_SERVICE_ROLE_KEY (or use SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function resolveOwnerRezEmail(
  supabase: ReturnType<typeof createClient>,
  connection: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (getOwnerRezEmail(connection)) return connection;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', connection.user_id as string)
    .maybeSingle();

  let email = typeof profile?.email === 'string' ? profile.email : null;

  if (!email) {
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(
      connection.user_id as string
    );
    if (!authError && authData.user?.email) {
      email = authData.user.email;
    }
  }

  if (!email) return connection;

  const credentials = (connection.api_credentials as Record<string, unknown> | null) ?? {};

  return {
    ...connection,
    api_credentials: {
      ...credentials,
      ownerrez_email: email,
    },
  };
}

async function ownerRezFetch(
  connection: Record<string, unknown>,
  token: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${OWNERREZ_API_BASE}${path}`;
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  const normalizedToken = token.trim();
  if (normalizedToken.toLowerCase().startsWith('pt_')) {
    const email = getOwnerRezEmail(connection);
    if (!email) {
      throw new Error(
        'OwnerRez personal access tokens require your OwnerRez login email. Remove this connection and add it again with your email filled in.'
      );
    }
    headers.set('Authorization', `Basic ${btoa(`${email}:${normalizedToken}`)}`);
  } else {
    headers.set('Authorization', `Bearer ${normalizedToken}`);
    headers.set('User-Agent', 'StayLoop/1.0');
  }

  return fetch(url, { ...init, headers });
}

async function fetchOwnerRezJson(
  connection: Record<string, unknown>,
  token: string,
  path: string
): Promise<Record<string, unknown>> {
  const response = await ownerRezFetch(connection, token, path);
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error(
        'OwnerRez login failed (401). Use the exact email you sign in with at ownerrez.com with your pt_ token. If you use Google on StayLoop, that email may not match OwnerRez — set ownerrez_email in Supabase or re-add the connection with your OwnerRez email.'
      );
    }
    throw new Error(`OwnerRez API error (${response.status}): ${body || response.statusText}`);
  }
  return response.json();
}

async function fetchAllOwnerRezItems(
  connection: Record<string, unknown>,
  token: string,
  initialPath: string
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let path: string | null = initialPath;

  while (path) {
    const page = await fetchOwnerRezJson(connection, token, path);
    const pageItems = Array.isArray(page) ? page : (page.items as Record<string, unknown>[]) || [];
    items.push(...pageItems);

    const nextPageUrl = page.next_page_url;
    if (typeof nextPageUrl === 'string' && nextPageUrl.length > 0) {
      path = nextPageUrl.replace(OWNERREZ_API_BASE, '');
    } else {
      path = null;
    }
  }

  return items;
}

function mapOwnerRezProperty(prop: Record<string, unknown>, connection: Record<string, unknown>) {
  const addr = (prop.address as Record<string, unknown>) || {};
  const street1 = typeof addr.street1 === 'string' ? addr.street1 : '';
  const street2 = typeof addr.street2 === 'string' ? addr.street2 : '';
  const addressLine =
    [street1, street2].filter(Boolean).join(', ') ||
    (typeof addr.address === 'string' ? addr.address : 'Address on file');

  const images: string[] = [];
  for (const key of ['thumbnail_url_large', 'thumbnail_url', 'thumbnail_url_medium']) {
    const value = prop[key];
    if (typeof value === 'string' && value.length > 0) {
      images.push(value);
    }
  }

  let propertyType = typeof prop.property_type === 'string' ? prop.property_type.toLowerCase() : 'house';
  const allowedTypes = new Set([
    'house',
    'apartment',
    'condo',
    'villa',
    'cabin',
    'cottage',
    'townhouse',
    'loft',
    'other',
  ]);
  if (!allowedTypes.has(propertyType)) {
    propertyType = 'other';
  }

  return {
    host_id: connection.user_id,
    title:
      (typeof prop.name === 'string' && prop.name) ||
      (typeof prop.external_name === 'string' && prop.external_name) ||
      'OwnerRez Property',
    description:
      typeof prop.public_url === 'string'
        ? `Imported from OwnerRez. View listing: ${prop.public_url}`
        : 'Imported from OwnerRez.',
    property_type: propertyType,
    address: addressLine,
    city: (typeof addr.city === 'string' && addr.city) || 'Unknown',
    state:
      (typeof addr.state === 'string' && addr.state) ||
      (typeof addr.province === 'string' && addr.province) ||
      'N/A',
    country: (typeof addr.country === 'string' && addr.country) || 'US',
    postal_code: typeof addr.postal_code === 'string' ? addr.postal_code : null,
    latitude: typeof prop.latitude === 'number' ? prop.latitude : null,
    longitude: typeof prop.longitude === 'number' ? prop.longitude : null,
    bedrooms: typeof prop.bedrooms === 'number' ? prop.bedrooms : 1,
    bathrooms: typeof prop.bathrooms === 'number' ? prop.bathrooms : 1,
    max_guests: typeof prop.max_guests === 'number' ? prop.max_guests : 2,
    base_price: 0,
    cleaning_fee: 0,
    amenities: [],
    images,
    is_active: prop.active !== false,
    pms_integration: {
      provider: 'ownerrez',
      property_id: String(prop.id),
      last_synced: new Date().toISOString(),
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createServiceSupabaseClient();

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

    const { data: hostProfile, error: hostProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', connection.user_id)
      .maybeSingle();

    if (hostProfileError || !hostProfile) {
      throw new Error(
        'Your StayLoop host profile is missing. Sign out, sign in again, then retry sync.'
      );
    }

    const resolvedConnection = await resolveOwnerRezEmail(supabase, connection);

    if (getOwnerRezEmail(resolvedConnection)) {
      await supabase
        .from('pms_connections')
        .update({ api_credentials: resolvedConnection.api_credentials })
        .eq('id', connection.id);
    }

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
        result = await syncProperties(supabase, resolvedConnection, ownerRezToken);
        break;
      case 'sync_bookings':
        result = await syncBookings(supabase, resolvedConnection, ownerRezToken, propertyId);
        break;
      case 'sync_availability':
        result = await syncAvailability(supabase, resolvedConnection, ownerRezToken, propertyId);
        break;
      case 'webhook':
        result = await handleWebhook(supabase, connection, webhookData);
        break;
      default:
        throw new Error('Invalid action');
    }

    if (action === 'sync_properties') {
      if (!result.processed) {
        throw new Error('OwnerRez returned no active properties for this account.');
      }
      if (!result.succeeded) {
        throw new Error(
          `Could not import any properties (${result.failed} failed). Check Edge Function logs in Supabase.`
        );
      }
    }

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
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncProperties(supabase: any, connection: any, token: string) {
  const properties = await fetchAllOwnerRezItems(
    connection,
    token,
    '/properties?active=true&include_fields=true'
  );
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const prop of properties) {
    processed++;
    try {
      const pmsPropertyId = String(prop.id);
      const { data: mapping } = await supabase
        .from('pms_property_mappings')
        .select('id, stayloop_property_id')
        .eq('pms_connection_id', connection.id)
        .eq('pms_property_id', pmsPropertyId)
        .maybeSingle();

      const propertyData = mapOwnerRezProperty(prop, connection);

      if (mapping) {
        const { error: updateError } = await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', mapping.stayloop_property_id);

        if (updateError) {
          throw updateError;
        }

        await supabase
          .from('pms_property_mappings')
          .update({
            pms_property_data: prop,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', mapping.id);
      } else {
        const { data: newProperty, error: insertError } = await supabase
          .from('properties')
          .insert(propertyData)
          .select()
          .single();

        if (insertError || !newProperty) {
          throw insertError || new Error('Failed to create StayLoop property');
        }

        await supabase.from('pms_property_mappings').insert({
          pms_connection_id: connection.id,
          stayloop_property_id: newProperty.id,
          pms_property_id: pmsPropertyId,
          pms_property_data: prop,
          last_synced_at: new Date().toISOString(),
        });
      }

      succeeded++;
    } catch (error) {
      console.error(`Failed to sync property ${String(prop.id)}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncBookings(supabase: any, connection: any, token: string, propertyId?: string) {
  const path = propertyId ? `/properties/${propertyId}/bookings` : '/bookings';
  const bookings = await fetchAllOwnerRezItems(connection, token, path);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const booking of bookings) {
    processed++;
    try {
      const bookingPropertyId = String(booking.property_id ?? booking.propertyId ?? '');
      const { data: mapping } = await supabase
        .from('pms_property_mappings')
        .select('id, stayloop_property_id')
        .eq('pms_connection_id', connection.id)
        .eq('pms_property_id', bookingPropertyId)
        .maybeSingle();

      if (!mapping) {
        failed++;
        continue;
      }

      const { data: property } = await supabase
        .from('properties')
        .select('host_id')
        .eq('id', mapping.stayloop_property_id)
        .single();

      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', mapping.stayloop_property_id)
        .eq('payment_intent_id', String(booking.id))
        .maybeSingle();

      if (!existingBooking) {
        const total = Number(booking.total || 0);
        const cleaningFee = Number(booking.cleaning_fee ?? booking.cleaningFee ?? 0);
        const guestServiceFee = Number((total * 0.05).toFixed(2));
        const hostServiceFee = Number((total * 0.1).toFixed(2));

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
          payment_intent_id: String(booking.id),
        });
      }

      succeeded++;
    } catch (error) {
      console.error(`Failed to sync booking ${String(booking.id)}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncAvailability(supabase: any, connection: any, token: string, propertyId?: string) {
  if (!propertyId) {
    throw new Error('Property ID required for availability sync');
  }

  const calendar = await fetchOwnerRezJson(connection, token, `/properties/${propertyId}/calendar`);
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

  const days = Array.isArray(calendar.days) ? calendar.days : [];
  for (const day of days) {
    processed++;
    try {
      await supabase.from('availability_calendar').upsert(
        {
          property_id: mapping.stayloop_property_id,
          date: day.date,
          is_available: day.available,
          price_override: day.rate,
        },
        { onConflict: 'property_id,date' }
      );
      succeeded++;
    } catch (error) {
      console.error(`Failed to sync availability for ${day.date}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function handleWebhook(supabase: any, connection: any, webhookData: any) {
  await supabase.from('pms_webhook_events').insert({
    pms_connection_id: connection.id,
    event_type: webhookData.event,
    event_data: webhookData,
  });

  switch (webhookData.event) {
    case 'booking.created':
    case 'booking.updated':
      break;
    case 'property.updated':
      break;
  }

  return { processed: 1, succeeded: 1, failed: 0 };
}
