import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const OWNERREZ_API_BASE = 'https://api.ownerrez.com/v2';

interface SyncRequest {
  action: 'sync_properties' | 'sync_bookings' | 'sync_availability' | 'sync_all' | 'webhook' | 'test_ownerrez';
  pmsConnectionId: string;
  propertyId?: string;
  webhookData?: any;
}


function syncTypeFromAction(action: string): string {
  switch (action) {
    case 'sync_properties':
      return 'property';
    case 'sync_bookings':
      return 'booking';
    case 'sync_availability':
      return 'availability';
    case 'sync_all':
      return 'full';
    case 'webhook':
      return 'webhook';
    case 'test_ownerrez':
      return 'property';
    default:
      return 'property';
  }
}

function getOwnerRezEmail(connection: Record<string, unknown>): string | null {
  const credentials = connection.api_credentials as Record<string, unknown> | null;
  const email = credentials?.ownerrez_email ?? credentials?.email;
  return typeof email === 'string' && email.includes('@') ? email : null;
}


function getServiceRoleKey(): string | undefined {
  const custom = Deno.env.get('STAYLOOP_SUPABASE_SERVICE_ROLE_KEY');
  if (custom) return custom;

  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      return parsed.service_role || parsed.default || Object.values(parsed)[0];
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function createServiceSupabaseClient() {
  const supabaseUrl = Deno.env.get('STAYLOOP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = getServiceRoleKey();

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

function buildOwnerRezAuthHeaders(connection: Record<string, unknown>, token: string): Headers {
  const headers = new Headers();
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
  }

  headers.set('User-Agent', 'StayLoop/1.0');
  return headers;
}

async function ownerRezFetch(
  connection: Record<string, unknown>,
  token: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${OWNERREZ_API_BASE}${path}`;
  const headers = buildOwnerRezAuthHeaders(connection, token);
  const requestHeaders = new Headers(init?.headers);
  headers.forEach((value, key) => requestHeaders.set(key, value));
  return fetch(url, { ...init, headers: requestHeaders });
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


const OWNERREZ_V1_BASE = 'https://api.ownerrez.com/v1';
const PRICING_SYNC_DAYS = 548;
const PRICING_CHUNK_DAYS = 90;

type PricingNight = {
  date: string;
  amount: number;
  minNights: number;
  isStayDisallowed: boolean;
};

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function fetchOwnerRezV1Json(
  connection: Record<string, unknown>,
  token: string,
  path: string
): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${OWNERREZ_V1_BASE}${path}`;
  const response = await fetch(url, { headers: buildOwnerRezAuthHeaders(connection, token) });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OwnerRez API error (${response.status}): ${body || response.statusText}`);
  }

  return response.json();
}

function normalizePricingNight(raw: Record<string, unknown>): PricingNight {
  return {
    date: String(raw.date),
    amount: Number(raw.amount ?? 0),
    minNights: Number(raw.minNights ?? raw.min_nights ?? 1),
    isStayDisallowed: Boolean(raw.isStayDisallowed ?? raw.is_stay_disallowed ?? false),
  };
}

async function fetchListingPricingNights(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<PricingNight[]> {
  const nights: PricingNight[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = addDays(today, PRICING_SYNC_DAYS);

  let chunkStart = new Date(today);
  while (chunkStart < endDate) {
    const chunkEnd = addDays(chunkStart, PRICING_CHUNK_DAYS - 1);
    const boundedEnd = chunkEnd > endDate ? endDate : chunkEnd;

    const path =
      `/listings/${propertyId}/pricing?start=${formatDateOnly(chunkStart)}&end=${formatDateOnly(boundedEnd)}&includePricingRules=true`;
    const payload = await fetchOwnerRezV1Json(connection, token, path);

    if (Array.isArray(payload)) {
      for (const entry of payload) {
        if (entry && typeof entry === 'object') {
          nights.push(normalizePricingNight(entry as Record<string, unknown>));
        }
      }
    }

    chunkStart = addDays(boundedEnd, 1);
  }

  return nights;
}

function deriveBasePrice(nights: PricingNight[]): number {
  const amounts = nights.map((night) => night.amount).filter((amount) => amount > 0);
  if (amounts.length === 0) return 0;

  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return Number((total / amounts.length).toFixed(2));
}

function deriveMinNights(nights: PricingNight[]): number | null {
  const values = nights.map((night) => night.minNights).filter((value) => value > 0);
  if (values.length === 0) return null;
  return Math.min(...values);
}

function expandBlockedDates(ranges: Record<string, unknown>[]): Set<string> {
  const blocked = new Set<string>();

  for (const range of ranges) {
    const arrival = range.arrival ?? range.start ?? range.startDate;
    const departure = range.departure ?? range.end ?? range.endDate;
    if (typeof arrival !== 'string' || typeof departure !== 'string') continue;

    let cursor = new Date(`${arrival}T12:00:00`);
    const end = new Date(`${departure}T12:00:00`);
    while (cursor < end) {
      blocked.add(formatDateOnly(cursor));
      cursor = addDays(cursor, 1);
    }
  }

  return blocked;
}

function extractAvailabilityRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['items', 'bookings', 'availability', 'results']) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value as Record<string, unknown>[];
      }
    }
  }
  return [];
}

async function fetchBlockedDatesFromV1Availability(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<Set<string>> {
  const today = formatDateOnly(new Date());
  const end = formatDateOnly(addDays(new Date(), PRICING_SYNC_DAYS));
  const path = `/listings/${propertyId}/availability?start=${today}&end=${end}`;
  const payload = await fetchOwnerRezV1Json(connection, token, path);
  return expandBlockedDates(extractAvailabilityRecords(payload));
}

async function fetchBlockedDatesFromV2Bookings(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<Set<string>> {
  const bookings = await fetchAllOwnerRezItems(
    connection,
    token,
    `/bookings?property_ids=${propertyId}&status=active`
  );

  const blocked = new Set<string>();
  for (const booking of bookings) {
    const status = String(booking.status ?? '').toLowerCase();
    if (status === 'canceled' || status === 'cancelled') continue;

    const arrival = booking.arrival ?? booking.check_in ?? booking.checkIn;
    const departure = booking.departure ?? booking.check_out ?? booking.checkOut;
    if (typeof arrival !== 'string' || typeof departure !== 'string') continue;

    for (const date of expandBlockedDates([{ arrival, departure }])) {
      blocked.add(date);
    }
  }

  return blocked;
}

async function fetchBlockedDates(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<Set<string>> {
  const blocked = new Set<string>();

  try {
    for (const date of await fetchBlockedDatesFromV1Availability(connection, token, propertyId)) {
      blocked.add(date);
    }
  } catch (error) {
    console.error(`OwnerRez v1 availability fetch failed for ${propertyId}:`, error);
  }

  try {
    for (const date of await fetchBlockedDatesFromV2Bookings(connection, token, propertyId)) {
      blocked.add(date);
    }
  } catch (error) {
    console.error(`OwnerRez v2 bookings fetch failed for ${propertyId}:`, error);
  }

  return blocked;
}

async function fetchCleaningFeeFromQuote(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<number> {
  const arrival = formatDateOnly(addDays(new Date(), 14));
  const departure = formatDateOnly(addDays(new Date(), 17));

  const response = await ownerRezFetch(connection, token, '/quotes', {
    method: 'POST',
    body: JSON.stringify({
      property_id: Number(propertyId),
      arrival,
      departure,
      adults: 2,
      generate_charges: true,
      test: true,
      validate_rules: false,
    }),
  });

  if (!response.ok) {
    return 0;
  }

  const quote = (await response.json()) as Record<string, unknown>;
  const charges = Array.isArray(quote.charges) ? quote.charges : [];

  for (const charge of charges) {
    if (!charge || typeof charge !== 'object') continue;
    const row = charge as Record<string, unknown>;
    const type = String(row.type ?? '').toLowerCase();
    const description = String(row.description ?? '').toLowerCase();
    const amount = Number(row.amount ?? 0);

    if (amount > 0 && (type.includes('clean') || description.includes('cleaning'))) {
      return Number(amount.toFixed(2));
    }
  }

  return 0;
}

async function syncOwnerRezPricingAndCalendar(
  supabase: ReturnType<typeof createClient>,
  connection: Record<string, unknown>,
  token: string,
  pmsPropertyId: string,
  stayloopPropertyId: string
) {
  const [pricingNights, blockedDates] = await Promise.all([
    fetchListingPricingNights(connection, token, pmsPropertyId),
    fetchBlockedDates(connection, token, pmsPropertyId),
  ]);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const syncedAt = new Date().toISOString();

  for (const night of pricingNights) {
    processed++;
    try {
      const unavailable = night.isStayDisallowed || blockedDates.has(night.date);
      await supabase.from('availability_calendar').upsert(
        {
          property_id: stayloopPropertyId,
          date: night.date,
          is_available: !unavailable,
          price_override: night.amount > 0 ? night.amount : null,
          min_nights_override: night.minNights > 0 ? night.minNights : null,
          source: 'ownerrez',
          synced_at: syncedAt,
        },
        { onConflict: 'property_id,date' }
      );
      succeeded++;
    } catch (error) {
      console.error(`Failed to sync pricing for ${night.date}:`, error);
      failed++;
    }
  }

  for (const date of blockedDates) {
    processed++;
    try {
      await supabase.from('availability_calendar').upsert(
        {
          property_id: stayloopPropertyId,
          date,
          is_available: false,
          source: 'ownerrez',
          synced_at: syncedAt,
        },
        { onConflict: 'property_id,date' }
      );
      succeeded++;
    } catch (error) {
      console.error(`Failed to sync blocked date ${date}:`, error);
      failed++;
    }
  }

  const basePrice = deriveBasePrice(pricingNights);
  const minNights = deriveMinNights(pricingNights);
  const cleaningFee = await fetchCleaningFeeFromQuote(connection, token, pmsPropertyId).catch(() => 0);

  const propertyUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    pms_integration: {
      provider: 'ownerrez',
      property_id: pmsPropertyId,
      last_pricing_sync: new Date().toISOString(),
    },
  };

  if (basePrice > 0) {
    propertyUpdate.base_price = basePrice;
  }
  if (cleaningFee > 0) {
    propertyUpdate.cleaning_fee = cleaningFee;
  }
  if (minNights && minNights > 0) {
    propertyUpdate.min_nights = minNights;
  }

  await supabase.from('properties').update(propertyUpdate).eq('id', stayloopPropertyId);

  return { processed, succeeded, failed, basePrice, cleaningFee };
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

    const cronSecret = Deno.env.get('PMS_CRON_SECRET') || Deno.env.get('STAYLOOP_PMS_CRON_SECRET');
    const providedCronSecret = req.headers.get('x-stayloop-cron-secret') || '';
    const cronActions = new Set(['sync_all', 'sync_availability', 'sync_bookings']);
    const isCronJob =
      cronActions.has(action) && Boolean(cronSecret && providedCronSecret === cronSecret);

    let authedUserId: string | null = null;
    if (action !== 'webhook' && !isCronJob) {
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

    const ownerRezToken = String(connection.oauth_access_token || connection.api_credentials?.access_token || '').trim();
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

    let syncLogId: string | null = null;
    if (action !== 'test_ownerrez') {
      const { data: syncLog, error: syncLogError } = await supabase
        .from('pms_sync_logs')
        .insert({
          pms_connection_id: pmsConnectionId,
          sync_type: syncTypeFromAction(action),
          sync_direction: 'from_pms',
          status: 'started',
        })
        .select()
        .single();

      if (syncLogError || !syncLog) {
        throw new Error(`Failed to create sync log: ${syncLogError?.message || 'unknown error'}`);
      }

      syncLogId = syncLog.id;
    }

    let result;

    switch (action) {
      case 'test_ownerrez':
        result = await testOwnerRezConnection(resolvedConnection, ownerRezToken);
        break;
      case 'sync_properties':
        result = await syncProperties(supabase, resolvedConnection, ownerRezToken);
        break;
      case 'sync_bookings':
        result = await syncBookings(supabase, resolvedConnection, ownerRezToken, propertyId);
        break;
      case 'sync_availability':
        result = await syncAvailability(supabase, resolvedConnection, ownerRezToken, propertyId);
        break;
      case 'sync_all':
        result = await syncAllFromOwnerRez(supabase, resolvedConnection, ownerRezToken);
        break;
      case 'webhook':
        result = await handleWebhook(supabase, resolvedConnection, ownerRezToken, webhookData);
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

async function testOwnerRezConnection(connection: Record<string, unknown>, token: string) {
  const properties = await fetchAllOwnerRezItems(
    connection,
    token,
    '/properties?active=true'
  );
  return {
    processed: properties.length,
    succeeded: properties.length,
    failed: 0,
    propertyCount: properties.length,
    email: getOwnerRezEmail(connection),
  };
}

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
      let stayloopPropertyId: string | null = mapping?.stayloop_property_id ?? null;

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

        stayloopPropertyId = newProperty.id;

        await supabase.from('pms_property_mappings').insert({
          pms_connection_id: connection.id,
          stayloop_property_id: newProperty.id,
          pms_property_id: pmsPropertyId,
          pms_property_data: prop,
          last_synced_at: new Date().toISOString(),
        });
      }

      if (stayloopPropertyId) {
        try {
          await syncOwnerRezPricingAndCalendar(
            supabase,
            connection,
            token,
            pmsPropertyId,
            stayloopPropertyId
          );
        } catch (pricingError) {
          console.error(`Pricing sync failed for property ${pmsPropertyId}:`, pricingError);
        }
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

  const { data: mapping } = await supabase
    .from('pms_property_mappings')
    .select('id, stayloop_property_id')
    .eq('pms_connection_id', connection.id)
    .eq('pms_property_id', propertyId)
    .single();

  if (!mapping) {
    throw new Error('Property mapping not found');
  }

  return syncOwnerRezPricingAndCalendar(
    supabase,
    connection,
    token,
    propertyId,
    mapping.stayloop_property_id
  );
}

function syncSettingsEnabled(connection: Record<string, unknown>, key: string): boolean {
  const settings = connection.sync_settings as Record<string, unknown> | null;
  if (!settings) return true;
  if (settings.auto_sync === false) return false;
  if (settings[key] === false) return false;
  return true;
}

async function syncAllFromOwnerRez(supabase: any, connection: any, token: string) {
  if (!syncSettingsEnabled(connection, 'availability') && !syncSettingsEnabled(connection, 'bookings')) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: true };
  }

  const { data: mappings, error } = await supabase
    .from('pms_property_mappings')
    .select('pms_property_id, stayloop_property_id, auto_sync_enabled')
    .eq('pms_connection_id', connection.id);

  if (error) throw error;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const calendarResults: Array<Record<string, unknown>> = [];

  if (syncSettingsEnabled(connection, 'availability')) {
    for (const mapping of mappings || []) {
      if (mapping.auto_sync_enabled === false) continue;
      processed++;
      try {
        const result = await syncOwnerRezPricingAndCalendar(
          supabase,
          connection,
          token,
          String(mapping.pms_property_id),
          mapping.stayloop_property_id
        );
        calendarResults.push(result);
        succeeded++;
      } catch (error) {
        console.error(`Calendar sync failed for ${mapping.pms_property_id}:`, error);
        failed++;
      }
    }
  }

  let bookingResult = { processed: 0, succeeded: 0, failed: 0 };
  if (syncSettingsEnabled(connection, 'bookings')) {
    bookingResult = await syncBookings(supabase, connection, token);
  }

  await supabase
    .from('pms_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      sync_status: failed > 0 && succeeded === 0 ? 'failed' : 'completed',
      sync_error: null,
    })
    .eq('id', connection.id);

  return {
    processed,
    succeeded,
    failed,
    calendars: calendarResults,
    bookings: bookingResult,
  };
}

async function handleWebhook(
  supabase: any,
  connection: any,
  token: string,
  webhookData: any
) {
  const eventType = String(webhookData?.event || webhookData?.type || 'unknown').toLowerCase();

  const { data: eventRow } = await supabase
    .from('pms_webhook_events')
    .insert({
      pms_connection_id: connection.id,
      event_type: eventType,
      event_data: webhookData,
      processed: false,
    })
    .select('id')
    .single();

  let result: Record<string, unknown> = { processed: 0, succeeded: 0, failed: 0 };

  try {
    if (eventType.includes('booking') || eventType.includes('reservation')) {
      if (syncSettingsEnabled(connection, 'bookings')) {
        result = await syncBookings(supabase, connection, token);
      }
    } else if (
      eventType.includes('property') ||
      eventType.includes('rate') ||
      eventType.includes('calendar') ||
      eventType.includes('availability')
    ) {
      const propertyId = webhookData?.property_id ?? webhookData?.propertyId;
      if (propertyId && syncSettingsEnabled(connection, 'availability')) {
        result = await syncAvailability(supabase, connection, token, String(propertyId));
      } else if (syncSettingsEnabled(connection, 'availability')) {
        result = await syncAllFromOwnerRez(supabase, connection, token);
      }
    } else {
      result = await syncAllFromOwnerRez(supabase, connection, token);
    }

    if (eventRow?.id) {
      await supabase
        .from('pms_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', eventRow.id);
    }
  } catch (error) {
    if (eventRow?.id) {
      await supabase
        .from('pms_webhook_events')
        .update({
          processed: false,
          error_details: {
            message: error instanceof Error ? error.message : 'Webhook processing failed',
          },
        })
        .eq('id', eventRow.id);
    }
    throw error;
  }

  return result;
}
