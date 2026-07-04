import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

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
    throw new Error('Missing Supabase URL or service role key for scheduled sync.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function isAutoSyncEnabled(syncSettings: unknown): boolean {
  if (!syncSettings || typeof syncSettings !== 'object') return true;
  const settings = syncSettings as Record<string, unknown>;
  if (settings.auto_sync === false) return false;
  return true;
}

function syncSettingsEnabled(syncSettings: unknown, key: string): boolean {
  if (!syncSettings || typeof syncSettings !== 'object') return true;
  const settings = syncSettings as Record<string, unknown>;
  if (settings.auto_sync === false) return false;
  if (settings[key] === false) return false;
  return true;
}

async function invokeOwnerRezSync(
  supabaseUrl: string,
  serviceRoleKey: string,
  cronSecret: string,
  body: Record<string, unknown>
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/pms-ownerrez-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      'x-stayloop-cron-secret': cronSecret,
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    throw new Error(
      typeof payload?.error === 'string' ? payload.error : `Scheduled sync failed (${response.status})`
    );
  }

  return payload;
}

async function syncOwnerRezConnectionInChunks(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  cronSecret: string,
  connection: {
    id: string;
    account_name: string | null;
    sync_settings: unknown;
  }
) {
  const { data: mappings, error: mappingsError } = await supabase
    .from('pms_property_mappings')
    .select('pms_property_id, auto_sync_enabled')
    .eq('pms_connection_id', connection.id);

  if (mappingsError) throw mappingsError;

  const calendarResults: Array<Record<string, unknown>> = [];
  let calendarsSucceeded = 0;
  let calendarsFailed = 0;

  if (syncSettingsEnabled(connection.sync_settings, 'availability')) {
    for (const mapping of mappings || []) {
      if (mapping.auto_sync_enabled === false) continue;

      const propertyId = String(mapping.pms_property_id);
      try {
        const payload = await invokeOwnerRezSync(supabaseUrl, serviceRoleKey, cronSecret, {
          action: 'sync_availability',
          pmsConnectionId: connection.id,
          propertyId,
        });
        calendarsSucceeded++;
        calendarResults.push({
          propertyId,
          success: true,
          result: payload?.result ?? payload,
        });
      } catch (error) {
        calendarsFailed++;
        console.error(`Calendar sync failed for property ${propertyId}:`, error);
        calendarResults.push({
          propertyId,
          success: false,
          error: error instanceof Error ? error.message : 'Calendar sync failed',
        });
      }
    }
  }

  let bookings: Record<string, unknown> | null = null;
  let bookingsError: string | null = null;

  if (syncSettingsEnabled(connection.sync_settings, 'bookings')) {
    try {
      const payload = await invokeOwnerRezSync(supabaseUrl, serviceRoleKey, cronSecret, {
        action: 'sync_bookings',
        pmsConnectionId: connection.id,
      });
      bookings = (payload?.result as Record<string, unknown>) ?? payload;
    } catch (error) {
      bookingsError = error instanceof Error ? error.message : 'Booking sync failed';
      console.error(`Booking sync failed for connection ${connection.id}:`, error);
    }
  }

  const calendarsProcessed = calendarsSucceeded + calendarsFailed;
  const overallSuccess =
    calendarsFailed === 0 && !bookingsError && (calendarsProcessed > 0 || bookings !== null);

  await supabase
    .from('pms_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      sync_status: overallSuccess ? 'completed' : calendarsSucceeded > 0 ? 'partial' : 'failed',
      sync_error: overallSuccess
        ? null
        : bookingsError ||
          (calendarsFailed > 0 ? `${calendarsFailed} property calendar sync(s) failed` : null),
    })
    .eq('id', connection.id);

  return {
    calendars: {
      processed: calendarsProcessed,
      succeeded: calendarsSucceeded,
      failed: calendarsFailed,
      results: calendarResults,
    },
    bookings,
    bookingsError,
    success: overallSuccess,
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('PMS_CRON_SECRET') || Deno.env.get('STAYLOOP_PMS_CRON_SECRET');
    const providedSecret = req.headers.get('x-stayloop-cron-secret') || '';

    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServiceSupabaseClient();
    const supabaseUrl = Deno.env.get('STAYLOOP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = getServiceRoleKey()!;

    const { data: connections, error } = await supabase
      .from('pms_connections')
      .select('id, pms_provider, account_name, sync_settings, is_active')
      .eq('is_active', true);

    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];

    for (const connection of connections || []) {
      if (!isAutoSyncEnabled(connection.sync_settings)) {
        results.push({
          connectionId: connection.id,
          skipped: true,
          reason: 'auto_sync disabled',
        });
        continue;
      }

      if (connection.pms_provider !== 'ownerrez') {
        results.push({
          connectionId: connection.id,
          skipped: true,
          reason: `${connection.pms_provider} scheduled sync not implemented yet`,
        });
        continue;
      }

      try {
        const syncResult = await syncOwnerRezConnectionInChunks(
          supabase,
          supabaseUrl,
          serviceRoleKey,
          cronSecret,
          connection
        );
        results.push({
          connectionId: connection.id,
          accountName: connection.account_name,
          success: syncResult.success,
          result: syncResult,
        });
      } catch (syncError) {
        console.error(`Scheduled sync failed for ${connection.id}:`, syncError);
        results.push({
          connectionId: connection.id,
          accountName: connection.account_name,
          success: false,
          error: syncError instanceof Error ? syncError.message : 'Sync failed',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        connections: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scheduled PMS sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Scheduled sync failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
