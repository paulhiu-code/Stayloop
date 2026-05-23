import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, x-stayloop-cron-secret',
};

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

async function invokeOwnerRezSyncAll(
  supabaseUrl: string,
  serviceRoleKey: string,
  cronSecret: string,
  pmsConnectionId: string
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/pms-ownerrez-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      'x-stayloop-cron-secret': cronSecret,
    },
    body: JSON.stringify({
      action: 'sync_all',
      pmsConnectionId,
    }),
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

Deno.serve(async (req: Request) => {
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
        const payload = await invokeOwnerRezSyncAll(
          supabaseUrl,
          serviceRoleKey,
          cronSecret,
          connection.id
        );
        results.push({
          connectionId: connection.id,
          accountName: connection.account_name,
          success: true,
          result: payload?.result ?? payload,
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
