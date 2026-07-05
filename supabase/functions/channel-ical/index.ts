import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  generateICalendar,
  parseICalendar,
  collectBlockedNights,
  type ICalBlock,
} from '../_shared/ical.ts';

/*
  Universal iCal channel sync.

  GET  ?action=export&property=<id>&token=<token>
       -> public text/calendar feed of StayLoop bookings + blocks for a property.
          Hosts paste this URL into Airbnb / VRBO / their PMS.

  POST { action: 'import', propertyId?, feedId? }
       -> pull external .ics feeds and write blocked nights into
          availability_calendar (source = 'ical'). Authenticated (host) or cron.
*/

interface ImportRequest {
  action: 'import';
  propertyId?: string;
  feedId?: string;
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function handleExport(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  propertyId: string,
  token: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!propertyId || !token) {
    return new Response('Missing property or token', { status: 400, headers: corsHeaders });
  }

  const { data: property, error } = await supabase
    .from('properties')
    .select('id, title, ical_export_token')
    .eq('id', propertyId)
    .maybeSingle();

  if (error || !property || property.ical_export_token !== token) {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }

  const from = todayISO();

  // Confirmed/active reservations block their nights.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, status')
    .eq('property_id', propertyId)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .gte('check_out', from);

  // Host/PMS-driven calendar blocks (not tied to a StayLoop booking).
  const { data: calendarBlocks } = await supabase
    .from('availability_calendar')
    .select('date, is_available')
    .eq('property_id', propertyId)
    .eq('is_available', false)
    .gte('date', from);

  const blocks: ICalBlock[] = [];

  for (const booking of bookings ?? []) {
    blocks.push({
      uid: `booking-${booking.id}@stayloop`,
      checkIn: String(booking.check_in).slice(0, 10),
      checkOut: String(booking.check_out).slice(0, 10),
      summary: 'StayLoop reservation',
    });
  }

  // Merge contiguous manual blocks into ranges so the feed stays compact.
  const blockedDates = (calendarBlocks ?? [])
    .map((row) => String(row.date).slice(0, 10))
    .sort();
  const nextDay = (date: string): string => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  let rangeStart: string | null = null;
  let prev: string | null = null;
  for (const date of blockedDates) {
    if (rangeStart === null) {
      rangeStart = date;
    } else if (prev && nextDay(prev) !== date) {
      blocks.push({
        uid: `block-${rangeStart}-${nextDay(prev)}@stayloop`,
        checkIn: rangeStart,
        checkOut: nextDay(prev),
        summary: 'Not available',
      });
      rangeStart = date;
    }
    prev = date;
  }
  if (rangeStart && prev) {
    blocks.push({
      uid: `block-${rangeStart}-${nextDay(prev)}@stayloop`,
      checkIn: rangeStart,
      checkOut: nextDay(prev),
      summary: 'Not available',
    });
  }

  const ics = generateICalendar({
    calendarName: `StayLoop — ${property.title ?? 'Property'}`,
    blocks,
  });

  return new Response(ics, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="stayloop-${propertyId}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}

async function importFeed(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  feed: { id: string; property_id: string; feed_url: string }
): Promise<{ feedId: string; nights: number; status: 'success' | 'failed'; error?: string }> {
  try {
    const response = await fetch(feed.feed_url, {
      headers: { 'User-Agent': 'StayLoop/1.0 (+https://stay-loop.co)' },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`Feed responded ${response.status}`);
    }
    const text = await response.text();
    const events = parseICalendar(text);
    const from = todayISO();
    const blockedNights = collectBlockedNights(events).filter((night) => night >= from);
    const syncedAt = new Date().toISOString();

    // Block the imported nights.
    for (const night of blockedNights) {
      await supabase.from('availability_calendar').upsert(
        {
          property_id: feed.property_id,
          date: night,
          is_available: false,
          source: 'ical',
          synced_at: syncedAt,
        },
        { onConflict: 'property_id,date' }
      );
    }

    // Release previously-imported iCal nights that are no longer blocked
    // (e.g. an external reservation was cancelled).
    const { data: previous } = await supabase
      .from('availability_calendar')
      .select('date')
      .eq('property_id', feed.property_id)
      .eq('source', 'ical')
      .eq('is_available', false)
      .gte('date', from);

    const nowBlocked = new Set(blockedNights);
    for (const row of previous ?? []) {
      const date = String(row.date).slice(0, 10);
      if (!nowBlocked.has(date)) {
        await supabase
          .from('availability_calendar')
          .update({ is_available: true, synced_at: syncedAt })
          .eq('property_id', feed.property_id)
          .eq('date', date)
          .eq('source', 'ical');
      }
    }

    await supabase
      .from('channel_ical_feeds')
      .update({
        last_imported_at: syncedAt,
        last_import_status: 'success',
        last_import_error: null,
        last_event_count: blockedNights.length,
        updated_at: syncedAt,
      })
      .eq('id', feed.id);

    return { feedId: feed.id, nights: blockedNights.length, status: 'success' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'iCal import failed';
    await supabase
      .from('channel_ical_feeds')
      .update({
        last_imported_at: new Date().toISOString(),
        last_import_status: 'failed',
        last_import_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', feed.id);
    return { feedId: feed.id, nights: 0, status: 'failed', error: message };
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const url = new URL(req.url);

    // --- Public export (GET) ---
    if (req.method === 'GET' && url.searchParams.get('action') === 'export') {
      return await handleExport(
        supabase,
        url.searchParams.get('property') ?? '',
        url.searchParams.get('token') ?? '',
        corsHeaders
      );
    }

    // --- Import (POST) ---
    const body = (await req.json().catch(() => ({}))) as ImportRequest;
    if (body.action !== 'import') {
      return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cronSecret = Deno.env.get('PMS_CRON_SECRET') || Deno.env.get('STAYLOOP_PMS_CRON_SECRET');
    const providedCronSecret = req.headers.get('x-stayloop-cron-secret') || '';
    const isCron = Boolean(cronSecret && providedCronSecret === cronSecret);

    let userId: string | null = null;
    if (!isCron) {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = userData.user.id;
    }

    let query = supabase
      .from('channel_ical_feeds')
      .select('id, property_id, feed_url, user_id')
      .eq('is_active', true);

    if (body.feedId) query = query.eq('id', body.feedId);
    if (body.propertyId) query = query.eq('property_id', body.propertyId);
    if (userId) query = query.eq('user_id', userId);

    const { data: feeds, error: feedsError } = await query;
    if (feedsError) throw feedsError;

    const results = [];
    for (const feed of feeds ?? []) {
      results.push(await importFeed(supabase, feed));
    }

    return new Response(
      JSON.stringify({
        success: true,
        feeds: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('channel-ical error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'channel-ical failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
