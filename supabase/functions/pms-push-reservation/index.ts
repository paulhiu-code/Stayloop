import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  getHostawayToken,
  getGuestyToken,
  HOSTAWAY_API_BASE,
  GUESTY_API_BASE,
  type PMSConnectionRow,
} from '../_shared/pms-auth.ts';

/*
  Outbound sync: push a StayLoop booking into every connected PMS whose
  sync_direction allows it, so the nights are blocked and fan out to the host's
  other channels (Airbnb/VRBO/etc.). Idempotent via pms_reservation_mappings.

  - Hostaway: POST /reservations with channelId 2020 (partner) -> real reservation.
  - Guesty:   POST /reservations status "reserved" -> blocks the calendar.
  - OwnerRez: App API cannot create channel bookings; block the calendar via a
    held quote until Channel-API partner status is granted.
*/

interface PushRequest {
  action?: 'push_booking';
  bookingId: string;
  connectionId?: string;
}

// Hard safety guard: OwnerRez's App API cannot create channel bookings, so
// outbound to OwnerRez is DISABLED until we hold Channel-API partner status.
// This is independent of a connection's sync_direction — even a two-way OwnerRez
// connection will never have anything written to it while this is false.
const OWNERREZ_OUTBOUND_ENABLED = false;

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

type Supabase = ReturnType<typeof createServiceSupabaseClient>;

interface BookingRow {
  id: string;
  property_id: string;
  guest_id: string;
  host_id: string;
  check_in: string;
  check_out: string;
  num_guests: number;
  total_amount: number;
  status: string;
}

interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

async function loadGuest(supabase: Supabase, guestId: string): Promise<GuestInfo> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', guestId)
    .maybeSingle();

  const fullName = (data?.full_name as string | null) ?? 'StayLoop Guest';
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: firstName || 'StayLoop',
    lastName: rest.join(' ') || 'Guest',
    email: (data?.email as string | null) ?? 'guest@stay-loop.co',
    phone: (data?.phone as string | null) ?? null,
  };
}

// --- Hostaway ---------------------------------------------------------------

async function pushHostaway(
  supabase: Supabase,
  connection: PMSConnectionRow,
  pmsPropertyId: string,
  booking: BookingRow,
  guest: GuestInfo
): Promise<{ pmsReservationId: string; pushType: 'reservation' }> {
  const token = await getHostawayToken(supabase, connection);
  const body = {
    channelId: 2020, // partner channel
    channelName: 'StayLoop',
    listingMapId: Number(pmsPropertyId),
    reservationId: booking.id,
    channelReservationId: booking.id,
    source: 'StayLoop',
    arrivalDate: booking.check_in.slice(0, 10),
    departureDate: booking.check_out.slice(0, 10),
    numberOfGuests: booking.num_guests,
    guestName: `${guest.firstName} ${guest.lastName}`.trim(),
    guestFirstName: guest.firstName,
    guestLastName: guest.lastName,
    guestEmail: guest.email,
    phone: guest.phone ?? undefined,
    totalPrice: Number(booking.total_amount) || 0,
    status: 'new',
  };

  const response = await fetch(`${HOSTAWAY_API_BASE}/reservations?forceOverbooking=0`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Hostaway reservation create failed (${response.status}): ${raw}`);
  }
  const payload = raw ? JSON.parse(raw) : {};
  const reservationId = String(payload?.result?.id ?? payload?.id ?? booking.id);
  return { pmsReservationId: reservationId, pushType: 'reservation' };
}

// --- Guesty -----------------------------------------------------------------

async function pushGuesty(
  supabase: Supabase,
  connection: PMSConnectionRow,
  pmsListingId: string,
  booking: BookingRow,
  guest: GuestInfo
): Promise<{ pmsReservationId: string; pushType: 'reservation' }> {
  const token = await getGuestyToken(supabase, connection);
  const body = {
    listingId: pmsListingId,
    checkInDateLocalized: booking.check_in.slice(0, 10),
    checkOutDateLocalized: booking.check_out.slice(0, 10),
    status: 'reserved', // blocks the calendar without collecting payment in Guesty
    source: 'StayLoop',
    originId: booking.id,
    guestsCount: booking.num_guests,
    guest: {
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      phone: guest.phone ?? undefined,
    },
    money: { totalPrice: Number(booking.total_amount) || 0, currency: 'USD' },
  };

  const response = await fetch(`${GUESTY_API_BASE}/reservations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Guesty reservation create failed (${response.status}): ${raw}`);
  }
  const payload = raw ? JSON.parse(raw) : {};
  const reservationId = String(payload?._id ?? payload?.id ?? booking.id);
  return { pmsReservationId: reservationId, pushType: 'reservation' };
}

// --- OwnerRez (block via held quote) ----------------------------------------

function ownerRezAuthHeaders(connection: PMSConnectionRow): Headers {
  const token = String(connection.oauth_access_token ?? '').trim();
  const headers = new Headers({ 'Content-Type': 'application/json', 'User-Agent': 'StayLoop/1.0' });
  if (token.toLowerCase().startsWith('pt_')) {
    const creds = connection.api_credentials ?? {};
    const email = (creds.ownerrez_email as string) ?? (creds.email as string) ?? '';
    if (!email) throw new Error('OwnerRez personal access token requires ownerrez_email.');
    headers.set('Authorization', `Basic ${btoa(`${email}:${token}`)}`);
  } else {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function pushOwnerRez(
  connection: PMSConnectionRow,
  pmsPropertyId: string,
  booking: BookingRow,
  guest: GuestInfo
): Promise<{ pmsReservationId: string; pushType: 'calendar_block' }> {
  const headers = ownerRezAuthHeaders(connection);

  // Create/attach a guest, then open a held quote to block the dates.
  const guestResponse = await fetch('https://api.ownerrez.com/v2/guests', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      first_name: guest.firstName,
      last_name: guest.lastName,
      email_address: guest.email,
    }),
  });
  const guestRaw = await guestResponse.text();
  if (!guestResponse.ok) {
    throw new Error(`OwnerRez guest create failed (${guestResponse.status}): ${guestRaw}`);
  }
  const guestId = (guestRaw ? JSON.parse(guestRaw) : {})?.id;

  const quoteResponse = await fetch('https://api.ownerrez.com/v2/quotes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      property_id: Number(pmsPropertyId),
      arrival: booking.check_in.slice(0, 10),
      departure: booking.check_out.slice(0, 10),
      adults: booking.num_guests,
      children: 0,
      pets: 0,
      guest_id: guestId,
      hold_dates: true,
    }),
  });
  const quoteRaw = await quoteResponse.text();
  if (!quoteResponse.ok) {
    throw new Error(`OwnerRez quote hold failed (${quoteResponse.status}): ${quoteRaw}`);
  }
  const quoteId = String((quoteRaw ? JSON.parse(quoteRaw) : {})?.id ?? booking.id);
  return { pmsReservationId: quoteId, pushType: 'calendar_block' };
}

async function pushToConnection(
  supabase: Supabase,
  connection: PMSConnectionRow,
  pmsPropertyId: string,
  mappingId: string,
  booking: BookingRow,
  guest: GuestInfo
): Promise<Record<string, unknown>> {
  // Idempotency: skip if we already pushed this booking to this connection.
  const { data: existing } = await supabase
    .from('pms_reservation_mappings')
    .select('id, status')
    .eq('booking_id', booking.id)
    .eq('pms_connection_id', connection.id)
    .maybeSingle();

  if (existing?.status === 'pushed') {
    return { connectionId: connection.id, status: 'already_pushed' };
  }

  // Never write to OwnerRez until Channel-API partner status is in place.
  if (connection.pms_provider === 'ownerrez' && !OWNERREZ_OUTBOUND_ENABLED) {
    const reason = 'OwnerRez outbound disabled pending Channel API partner status';
    if (existing?.id) {
      await supabase
        .from('pms_reservation_mappings')
        .update({ status: 'skipped', last_error: reason, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('pms_reservation_mappings').insert({
        booking_id: booking.id,
        pms_connection_id: connection.id,
        pms_property_mapping_id: mappingId,
        status: 'skipped',
        last_error: reason,
      });
    }
    return { connectionId: connection.id, provider: 'ownerrez', status: 'skipped', reason };
  }

  const mappingRowId =
    existing?.id ??
    (
      await supabase
        .from('pms_reservation_mappings')
        .insert({
          booking_id: booking.id,
          pms_connection_id: connection.id,
          pms_property_mapping_id: mappingId,
          status: 'pending',
        })
        .select('id')
        .single()
    ).data?.id;

  try {
    let result: { pmsReservationId: string; pushType: 'reservation' | 'calendar_block' };
    switch (connection.pms_provider) {
      case 'hostaway':
        result = await pushHostaway(supabase, connection, pmsPropertyId, booking, guest);
        break;
      case 'guesty':
        result = await pushGuesty(supabase, connection, pmsPropertyId, booking, guest);
        break;
      case 'ownerrez':
        result = await pushOwnerRez(connection, pmsPropertyId, booking, guest);
        break;
      default:
        throw new Error(`Unsupported provider: ${connection.pms_provider}`);
    }

    await supabase
      .from('pms_reservation_mappings')
      .update({
        pms_reservation_id: result.pmsReservationId,
        push_type: result.pushType,
        status: 'pushed',
        last_error: null,
        pushed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mappingRowId);

    await supabase.from('pms_sync_logs').insert({
      pms_connection_id: connection.id,
      pms_property_mapping_id: mappingId,
      sync_type: 'booking',
      sync_direction: 'to_pms',
      status: 'completed',
      records_processed: 1,
      records_succeeded: 1,
      completed_at: new Date().toISOString(),
    });

    return {
      connectionId: connection.id,
      provider: connection.pms_provider,
      status: 'pushed',
      pushType: result.pushType,
      pmsReservationId: result.pmsReservationId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outbound push failed';
    await supabase
      .from('pms_reservation_mappings')
      .update({ status: 'failed', last_error: message, updated_at: new Date().toISOString() })
      .eq('id', mappingRowId);

    await supabase.from('pms_sync_logs').insert({
      pms_connection_id: connection.id,
      pms_property_mapping_id: mappingId,
      sync_type: 'booking',
      sync_direction: 'to_pms',
      status: 'failed',
      records_processed: 1,
      records_failed: 1,
      error_details: { message },
      completed_at: new Date().toISOString(),
    });

    return { connectionId: connection.id, provider: connection.pms_provider, status: 'failed', error: message };
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { bookingId, connectionId }: PushRequest = await req.json();

    if (!bookingId) {
      return new Response(JSON.stringify({ success: false, error: 'bookingId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, property_id, guest_id, host_id, check_in, check_out, num_guests, total_amount, status')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Authorization: service role (server), cron, or the owning host.
    const serviceRole = isServiceRoleRequest(req);
    if (!serviceRole) {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user || userData.user.id !== booking.host_id) {
        return new Response(JSON.stringify({ success: false, error: 'Not authorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Find property mappings on connections that allow outbound sync.
    let mappingQuery = supabase
      .from('pms_property_mappings')
      .select(
        'id, pms_property_id, pms_connection_id, ' +
          'pms_connections!inner(id, user_id, pms_provider, is_active, sync_direction, oauth_access_token, oauth_refresh_token, oauth_expires_at, api_credentials)'
      )
      .eq('stayloop_property_id', booking.property_id)
      .eq('auto_sync_enabled', true)
      .eq('pms_connections.is_active', true)
      .in('pms_connections.sync_direction', ['outbound', 'two_way']);

    if (connectionId) {
      mappingQuery = mappingQuery.eq('pms_connection_id', connectionId);
    }

    const { data: mappings, error: mappingError } = await mappingQuery;
    if (mappingError) throw mappingError;

    if (!mappings || mappings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, pushed: 0, message: 'No outbound PMS connections for this property' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const guest = await loadGuest(supabase, booking.guest_id);
    const results = [];
    for (const mapping of mappings as unknown as Array<Record<string, unknown>>) {
      const connection = mapping.pms_connections as PMSConnectionRow;
      results.push(
        await pushToConnection(
          supabase,
          connection,
          String(mapping.pms_property_id),
          mapping.id as string,
          booking as BookingRow,
          guest
        )
      );
    }

    return new Response(
      JSON.stringify({ success: true, pushed: results.filter((r) => r.status === 'pushed').length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('pms-push-reservation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Push failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
