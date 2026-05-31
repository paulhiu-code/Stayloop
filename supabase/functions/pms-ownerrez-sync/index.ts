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

function normalizeOwnerRezPaginationPath(nextPageUrl: string): string {
  if (nextPageUrl.startsWith('http')) {
    return nextPageUrl
      .replace(OWNERREZ_API_BASE, '')
      .replace('https://api.ownerrez.com/v2', '')
      .replace('https://api.ownerrez.com', '');
  }
  if (nextPageUrl.startsWith('/v2/')) {
    return nextPageUrl.slice(3);
  }
  return nextPageUrl;
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
      path = normalizeOwnerRezPaginationPath(nextPageUrl);
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

function normalizeDateOnly(value: unknown): string {
  const raw = String(value ?? '');
  if (raw.length >= 10 && raw[4] === '-' && raw[7] === '-') {
    return raw.slice(0, 10);
  }
  return raw;
}

function isPricingNightUnavailable(raw: Record<string, unknown>): boolean {
  // Only "stay" disallowed means the night itself is not bookable.
  // Arrival/departure flags affect check-in/out rules; reservations come from bookings feed.
  return raw.isStayDisallowed === true || raw.is_stay_disallowed === true;
}

function normalizePricingNight(raw: Record<string, unknown>): PricingNight {
  return {
    date: normalizeDateOnly(raw.date),
    amount: Number(raw.amount ?? 0),
    minNights: Number(raw.minNights ?? raw.min_nights ?? 1),
    isStayDisallowed: isPricingNightUnavailable(raw),
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
    const arrival = range.arrival ?? range.Arrival ?? range.start ?? range.startDate;
    const departure = range.departure ?? range.Departure ?? range.end ?? range.endDate;
    if (arrival == null || departure == null) continue;

    const arrivalDate = normalizeDateOnly(arrival);
    const departureDate = normalizeDateOnly(departure);
    if (!arrivalDate || !departureDate) continue;

    let cursor = new Date(`${arrivalDate}T12:00:00`);
    const end = new Date(`${departureDate}T12:00:00`);
    while (cursor < end) {
      blocked.add(formatDateOnly(cursor));
      cursor = addDays(cursor, 1);
    }
  }

  return blocked;
}


function bookingBelongsToProperty(booking: Record<string, unknown>, propertyId: string): boolean {
  const bookingPropertyId = String(
    booking.property_id ??
      booking.propertyId ??
      booking.property?.id ??
      booking.listing_id ??
      booking.listingId ??
      ''
  );
  return bookingPropertyId === String(propertyId);
}

function addBookingRangeToBlocked(
  booking: Record<string, unknown>,
  blocked: Set<string>
) {
  const status = String(booking.status ?? '').toLowerCase();
  if (status === 'canceled' || status === 'cancelled') return;

  const arrival =
    booking.arrival ?? booking.Arrival ?? booking.check_in ?? booking.checkIn ?? booking.start;
  const departure =
    booking.departure ?? booking.Departure ?? booking.check_out ?? booking.checkOut ?? booking.end;
  if (arrival == null || departure == null) return;

  for (const date of expandBlockedDates([{ arrival, departure }])) {
    blocked.add(date);
  }
}

async function fetchBlockedDatesFromV1ListingAvailability(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<Set<string>> {
  const today = formatDateOnly(new Date());
  const end = formatDateOnly(addDays(new Date(), PRICING_SYNC_DAYS));
  const path = `/listings/availability?ids=${propertyId}&start=${today}&end=${end}`;
  const payload = await fetchOwnerRezV1Json(connection, token, path);

  const records = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
  const bookingLike = records.filter((row) => row.arrival != null && row.departure != null);
  return expandBlockedDates(bookingLike);
}

async function fetchBlockedDatesFromV2Bookings(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<Set<string>> {
  const blocked = new Set<string>();
  const today = formatDateOnly(new Date());
  const end = formatDateOnly(addDays(new Date(), PRICING_SYNC_DAYS));
  const paths = [`/bookings?property_ids=${propertyId}&from=${today}&to=${end}&include_guest=true`];

  for (const path of paths) {
    const bookings = await fetchAllOwnerRezItems(connection, token, path);
    for (const booking of bookings) {
      if (!bookingBelongsToProperty(booking, propertyId)) continue;
      addBookingRangeToBlocked(booking, blocked);
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
    for (const date of await fetchBlockedDatesFromV1ListingAvailability(connection, token, propertyId)) {
      blocked.add(date);
    }
  } catch (error) {
    console.error(`OwnerRez v1 listing availability failed for ${propertyId}:`, error);
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

async function fetchOwnerRezPropertyDetail(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<Record<string, unknown>> {
  return fetchOwnerRezJson(connection, token, `/properties/${propertyId}?include_fields=true`);
}

async function tryFetchOwnerRezListing(
  connection: Record<string, unknown>,
  token: string,
  propertyId: string
): Promise<Record<string, unknown> | null> {
  try {
    const response = await ownerRezFetch(
      connection,
      token,
      `/listings/${encodeURIComponent(propertyId)}?includeImages=true&includeDescriptions=true&includeAmenities=true&includeRooms=true`
    );
    if (response.status === 402) {
      console.warn(`OwnerRez listings API unavailable for property ${propertyId} (premium feature disabled)`);
      return null;
    }
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    console.warn(`OwnerRez listings fetch failed for property ${propertyId}:`, error);
    return null;
  }
}

async function fetchOwnerRezGuestContact(
  connection: Record<string, unknown>,
  token: string,
  guestId: string | number
): Promise<{ guest_email: string | null; guest_phone: string | null }> {
  try {
    const guest = await fetchOwnerRezJson(connection, token, `/guests/${guestId}`);
    const emails = Array.isArray(guest.email_addresses) ? guest.email_addresses : [];
    const phones = Array.isArray(guest.phone_numbers) ? guest.phone_numbers : [];
    const defaultEmail = emails.find((row) => row && typeof row === 'object' && (row as Record<string, unknown>).is_default);
    const defaultPhone = phones.find((row) => row && typeof row === 'object' && (row as Record<string, unknown>).is_default);
    const emailRow = (defaultEmail || emails[0]) as Record<string, unknown> | undefined;
    const phoneRow = (defaultPhone || phones[0]) as Record<string, unknown> | undefined;

    return {
      guest_email: typeof emailRow?.address === 'string' ? emailRow.address : null,
      guest_phone:
        (typeof phoneRow?.number === 'string' && phoneRow.number) ||
        (typeof phoneRow?.phone === 'string' ? phoneRow.phone : null),
    };
  } catch {
    return { guest_email: null, guest_phone: null };
  }
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
      const unavailable = Boolean(night.isStayDisallowed) || blockedDates.has(night.date);
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

  const pricingDates = new Set(pricingNights.map((night) => night.date));
  for (const date of blockedDates) {
    if (!pricingDates.has(date)) {
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
  }

  const basePrice = deriveBasePrice(pricingNights);
  const minNights = deriveMinNights(pricingNights);
  // Pull-only: never POST test quotes to OwnerRez during calendar sync.
  const cleaningFee = 0;

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

  const availableNights = pricingNights.filter(
    (night) => !night.isStayDisallowed && !blockedDates.has(night.date)
  ).length;

  return {
    processed,
    succeeded,
    failed,
    basePrice,
    cleaningFee,
    blockedNights: blockedDates.size,
    availableNights,
    pricingNights: pricingNights.length,
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractOwnerRezListingDescription(listing: Record<string, unknown> | null | undefined): string | null {
  if (!listing) return null;
  const descriptions = listing.descriptions;
  if (!descriptions || typeof descriptions !== 'object' || Array.isArray(descriptions)) {
    return null;
  }

  const row = descriptions as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof row.headline === 'string' && row.headline.trim()) {
    parts.push(row.headline.trim());
  }
  if (typeof row.short_description === 'string' && row.short_description.trim()) {
    parts.push(stripHtml(row.short_description.trim()));
  }
  if (typeof row.description === 'string' && row.description.trim()) {
    parts.push(stripHtml(row.description.trim()));
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

function extractOwnerRezListingImages(listing: Record<string, unknown> | null | undefined): string[] {
  const images: string[] = [];
  const sources = [listing?.photos, listing?.images];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const image of source) {
      if (typeof image === 'string' && image.length > 0) {
        images.push(image);
        continue;
      }
      if (!image || typeof image !== 'object') continue;
      const row = image as Record<string, unknown>;
      for (const key of ['large_url', 'original_url', 'url', 'cropped_url', 'thumbnail_url']) {
        const value = row[key];
        if (typeof value === 'string' && value.length > 0) {
          images.push(value);
          break;
        }
      }
    }
  }
  return [...new Set(images)];
}

function extractOwnerRezListingAmenities(listing: Record<string, unknown> | null | undefined): string[] {
  const amenities = new Set<string>();
  const flat = listing?.amenities;
  if (Array.isArray(flat)) {
    for (const amenity of flat) {
      if (typeof amenity === 'string' && amenity.trim()) amenities.add(amenity.trim());
      else if (amenity && typeof amenity === 'object') {
        const name = (amenity as Record<string, unknown>).name;
        if (typeof name === 'string' && name.trim()) amenities.add(name.trim());
      }
    }
  }

  const categories = listing?.amenity_categories;
  if (Array.isArray(categories)) {
    for (const category of categories) {
      if (!category || typeof category !== 'object') continue;
      const rows = (category as Record<string, unknown>).amenities;
      if (!Array.isArray(rows)) continue;
      for (const amenity of rows) {
        if (typeof amenity === 'string' && amenity.trim()) amenities.add(amenity.trim());
        else if (amenity && typeof amenity === 'object') {
          const name = (amenity as Record<string, unknown>).name;
          if (typeof name === 'string' && name.trim()) amenities.add(name.trim());
        }
      }
    }
  }

  return [...amenities];
}

function mapOwnerRezProperty(
  prop: Record<string, unknown>,
  connection: Record<string, unknown>,
  enrichment?: {
    detail?: Record<string, unknown> | null;
    listing?: Record<string, unknown> | null;
  }
) {
  const merged = {
    ...prop,
    ...(enrichment?.detail || {}),
  };

  const addr = (merged.address as Record<string, unknown>) || {};
  const street1 = typeof addr.street1 === 'string' ? addr.street1 : '';
  const street2 = typeof addr.street2 === 'string' ? addr.street2 : '';
  const addressLine =
    [street1, street2].filter(Boolean).join(', ') ||
    (typeof addr.address === 'string' ? addr.address : 'Address on file');

  const images = extractOwnerRezListingImages(enrichment?.listing ?? null);
  if (images.length === 0) {
    for (const key of ['thumbnail_url_large', 'thumbnail_url', 'thumbnail_url_medium']) {
      const value = merged[key];
      if (typeof value === 'string' && value.length > 0) {
        images.push(value);
      }
    }
  }

  const amenities = extractOwnerRezListingAmenities(enrichment?.listing ?? null);

  let description =
    extractOwnerRezListingDescription(enrichment?.listing ?? null) ||
    (typeof merged.public_url === 'string'
      ? `Imported from OwnerRez. View listing: ${merged.public_url}`
      : 'Imported from OwnerRez.');

  const houseRules =
    typeof enrichment?.listing?.check_in_instructions === 'string' &&
    enrichment.listing.check_in_instructions.trim()
      ? stripHtml(enrichment.listing.check_in_instructions.trim())
      : null;

  let propertyType = typeof merged.property_type === 'string' ? merged.property_type.toLowerCase() : 'house';
  const allowedTypes = new Set([
    'house', 'apartment', 'condo', 'villa', 'cabin', 'cottage', 'townhouse', 'loft', 'other',
    'entire_home', 'private_room', 'shared_room', 'hotel_room', 'unique_stay', 'studio',
    'bungalow', 'chalet', 'farm_stay',
  ]);
  if (!allowedTypes.has(propertyType)) {
    propertyType = 'other';
  }

  const listingCancellation =
    typeof enrichment?.listing?.cancellation_policy === 'string'
      ? enrichment.listing.cancellation_policy
      : null;

  return {
    host_id: connection.user_id,
    title:
      (typeof merged.name === 'string' && merged.name) ||
      (typeof merged.external_name === 'string' && merged.external_name) ||
      'OwnerRez Property',
    description,
    property_type: propertyType,
    address: addressLine,
    city: (typeof addr.city === 'string' && addr.city) || 'Unknown',
    state:
      (typeof addr.state === 'string' && addr.state) ||
      (typeof addr.province === 'string' && addr.province) ||
      'N/A',
    country: (typeof addr.country === 'string' && addr.country) || 'US',
    postal_code: typeof addr.postal_code === 'string' ? addr.postal_code : null,
    latitude: typeof merged.latitude === 'number' ? merged.latitude : null,
    longitude: typeof merged.longitude === 'number' ? merged.longitude : null,
    bedrooms: typeof merged.bedrooms === 'number' ? merged.bedrooms : 1,
    bathrooms: typeof merged.bathrooms === 'number' ? merged.bathrooms : 1,
    max_guests: typeof merged.max_guests === 'number' ? merged.max_guests : 2,
    max_adults: typeof merged.max_adults === 'number' ? merged.max_adults : null,
    max_children: typeof merged.max_children === 'number' ? merged.max_children : null,
    max_pets: typeof merged.max_pets === 'number' ? merged.max_pets : null,
    check_in_time: typeof merged.check_in === 'string' ? merged.check_in : null,
    check_out_time: typeof merged.check_out === 'string' ? merged.check_out : null,
    currency_code: typeof merged.currency_code === 'string' ? merged.currency_code : 'USD',
    timezone: typeof merged.time_zone === 'string' ? merged.time_zone : null,
    cancellation_policy: listingCancellation,
    house_rules: houseRules,
    base_price: 0,
    cleaning_fee: 0,
    amenities,
    images,
    is_active: merged.active !== false,
    external_pms_property_id: String(merged.id),
    external_pms_provider: 'ownerrez',
    synced_at: new Date().toISOString(),
    pms_integration: {
      provider: 'ownerrez',
      property_id: String(merged.id),
      last_synced: new Date().toISOString(),
    },
  };
}

function mapOwnerRezBookingStatus(booking: Record<string, unknown>): string {
  const status = String(booking.status ?? '').toLowerCase();
  if (status === 'canceled' || status === 'cancelled') return 'cancelled';
  if (status === 'confirmed' || status === 'active') return 'confirmed';
  return 'pending';
}

function extractOwnerRezGuestInfo(booking: Record<string, unknown>) {
  const guest = booking.guest as Record<string, unknown> | undefined;
  if (!guest) {
    return { guest_name: null, guest_email: null, guest_phone: null };
  }

  const firstName = typeof guest.first_name === 'string' ? guest.first_name : '';
  const lastName = typeof guest.last_name === 'string' ? guest.last_name : '';
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    (typeof guest.name === 'string' ? guest.name : null);

  return {
    guest_name: fullName,
    guest_email: typeof guest.email === 'string' ? guest.email : null,
    guest_phone:
      (typeof guest.phone === 'string' && guest.phone) ||
      (typeof guest.phone_number === 'string' ? guest.phone_number : null),
  };
}

function ownerRezBookingQuerySuffix(): string {
  return 'include_guest=true&include_charges=true';
}

function buildOwnerRezBookingsPath(propertyId?: string): string {
  const suffix = ownerRezBookingQuerySuffix();
  if (propertyId) {
    return `/bookings?property_ids=${encodeURIComponent(propertyId)}&${suffix}`;
  }

  const since = new Date();
  since.setFullYear(since.getFullYear() - 2);
  return `/bookings?since_utc=${encodeURIComponent(since.toISOString())}&${suffix}`;
}

function calculateOwnerRezBookingNights(booking: Record<string, unknown>): number {
  if (typeof booking.nights === 'number' && booking.nights > 0) {
    return booking.nights;
  }

  const arrival = booking.arrival ?? booking.check_in;
  const departure = booking.departure ?? booking.check_out;
  if (arrival == null || departure == null) {
    return 1;
  }

  const start = new Date(`${normalizeDateOnly(arrival)}T12:00:00`);
  const end = new Date(`${normalizeDateOnly(departure)}T12:00:00`);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  return nights > 0 ? nights : 1;
}

function calculateOwnerRezBookingAmounts(booking: Record<string, unknown>) {
  const total = Number(booking.total_amount ?? booking.total ?? 0);
  const charges = Array.isArray(booking.charges) ? booking.charges : [];
  let cleaningFee = 0;

  for (const charge of charges) {
    if (!charge || typeof charge !== 'object') continue;
    const row = charge as Record<string, unknown>;
    const type = String(row.type ?? '').toLowerCase();
    const description = String(row.description ?? '').toLowerCase();
    const amount = Number(row.amount ?? 0);
    if (amount > 0 && (type.includes('clean') || description.includes('cleaning'))) {
      cleaningFee += amount;
    }
  }

  const guestServiceFee = Number((total * 0.05).toFixed(2));
  const hostServiceFee = Number((total * 0.1).toFixed(2));

  return {
    total,
    cleaningFee: Number(cleaningFee.toFixed(2)),
    guestServiceFee,
    hostServiceFee,
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

      const [detail, listing] = await Promise.all([
        fetchOwnerRezPropertyDetail(connection, token, pmsPropertyId).catch(() => null),
        tryFetchOwnerRezListing(connection, token, pmsPropertyId),
      ]);
      const propertyData = mapOwnerRezProperty(prop, connection, { detail, listing });
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

      // Calendar/pricing runs via sync_all or sync_availability to avoid worker timeouts.

      succeeded++;
    } catch (error) {
      console.error(`Failed to sync property ${String(prop.id)}:`, error);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

async function syncBookings(supabase: any, connection: any, token: string, propertyId?: string) {
  const bookings = await fetchAllOwnerRezItems(connection, token, buildOwnerRezBookingsPath(propertyId));
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const guestContactCache = new Map<string, { guest_email: string | null; guest_phone: string | null }>();

  for (const booking of bookings) {
    processed++;
    try {
      const bookingPropertyId = String(
        booking.property_id ?? booking.propertyId ?? booking.property?.id ?? ''
      );
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

      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('host_id')
        .eq('id', mapping.stayloop_property_id)
        .single();

      if (propertyError || !property) {
        throw propertyError || new Error('Property not found for booking mapping');
      }

      const externalBookingId = String(booking.id);
      const guestInfo = extractOwnerRezGuestInfo(booking);
      const guestId = booking.guest_id ?? booking.guest?.id;

      if ((!guestInfo.guest_email || !guestInfo.guest_phone) && guestId != null) {
        const cacheKey = String(guestId);
        if (!guestContactCache.has(cacheKey)) {
          guestContactCache.set(cacheKey, await fetchOwnerRezGuestContact(connection, token, cacheKey));
        }
        const contact = guestContactCache.get(cacheKey)!;
        if (!guestInfo.guest_email) guestInfo.guest_email = contact.guest_email;
        if (!guestInfo.guest_phone) guestInfo.guest_phone = contact.guest_phone;
      }

      const { total, cleaningFee, guestServiceFee, hostServiceFee } = calculateOwnerRezBookingAmounts(booking);
      const syncedAt = new Date().toISOString();
      const bookingRow = {
        property_id: mapping.stayloop_property_id,
        guest_id: null,
        host_id: property.host_id,
        check_in: normalizeDateOnly(booking.arrival ?? booking.check_in),
        check_out: normalizeDateOnly(booking.departure ?? booking.check_out),
        num_guests:
          Number(booking.adults ?? booking.guests ?? 1) +
          Number(booking.children ?? 0) +
          Number(booking.infants ?? 0),
        total_nights: calculateOwnerRezBookingNights(booking),
        base_amount: total,
        cleaning_fee: cleaningFee,
        guest_service_fee: guestServiceFee,
        host_service_fee: hostServiceFee,
        total_amount: total + guestServiceFee,
        host_payout: total - hostServiceFee,
        status: mapOwnerRezBookingStatus(booking),
        external_pms_booking_id: externalBookingId,
        external_pms_provider: 'ownerrez',
        booking_source:
          typeof booking.listing_site === 'string'
            ? booking.listing_site.toLowerCase()
            : 'ownerrez',
        is_block: booking.is_block === true || booking.type === 'block',
        guest_name: guestInfo.guest_name,
        guest_email: guestInfo.guest_email,
        guest_phone: guestInfo.guest_phone,
        synced_at: syncedAt,
        sync_direction: 'from_pms',
      };

      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', mapping.stayloop_property_id)
        .eq('external_pms_booking_id', externalBookingId)
        .maybeSingle();

      let stayloopBookingId: string;
      if (existingBooking) {
        const { error: updateError } = await supabase
          .from('bookings')
          .update(bookingRow)
          .eq('id', existingBooking.id);
        if (updateError) throw updateError;
        stayloopBookingId = existingBooking.id;
      } else {
        const { data: insertedBooking, error: insertError } = await supabase
          .from('bookings')
          .insert(bookingRow)
          .select('id')
          .single();
        if (insertError || !insertedBooking) {
          throw insertError || new Error('Failed to insert imported booking');
        }
        stayloopBookingId = insertedBooking.id;
      }

      await supabase.from('pms_booking_mappings').upsert(
        {
          pms_connection_id: connection.id,
          stayloop_booking_id: stayloopBookingId,
          pms_booking_id: externalBookingId,
          pms_quote_id: booking.quote_id != null ? String(booking.quote_id) : null,
          last_synced_at: syncedAt,
          sync_status: 'synced',
          updated_at: syncedAt,
        },
        { onConflict: 'pms_connection_id,pms_booking_id' }
      );

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
