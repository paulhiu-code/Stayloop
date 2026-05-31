import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildOwnerRezOutboundPlan,
  isOwnerRezOutboundEnabled,
  markQueueJobComplete,
  markQueueJobFailed,
  type PmsSyncQueueRow,
  updateBookingMappingAfterOutbound,
} from '../_shared/pms-sync.ts';

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
    throw new Error('Missing Supabase URL or service role key.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function processJob(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  job: PmsSyncQueueRow,
  provider: string
) {
  await supabase
    .from('pms_sync_queue')
    .update({ status: 'processing' })
    .eq('id', job.id);

  const plan = buildOwnerRezOutboundPlan(job, provider);
  const dryRun = Boolean(plan.dryRun);

  await markQueueJobComplete(supabase, job.id, plan, dryRun);

  if (job.entity_type === 'booking' && job.entity_id) {
    await updateBookingMappingAfterOutbound(
      supabase,
      job.pms_connection_id,
      job.entity_id,
      dryRun ? 'dry_run' : 'pending'
    );
  }

  return plan;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('PMS_CRON_SECRET') || Deno.env.get('STAYLOOP_PMS_CRON_SECRET');
    const providedSecret = req.headers.get('x-stayloop-cron-secret') || '';
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace('Bearer ', '');

    const isCron = Boolean(cronSecret && providedSecret === cronSecret);
    const isServiceRole = Boolean(bearer && bearer === getServiceRoleKey());

    if (!isCron && !isServiceRole) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Number(body.limit) || 25, 100);
    const connectionId = typeof body.pmsConnectionId === 'string' ? body.pmsConnectionId : null;

    const supabase = createServiceSupabaseClient();

    let query = supabase
      .from('pms_sync_queue')
      .select('*')
      .eq('direction', 'to_pms')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (connectionId) {
      query = query.eq('pms_connection_id', connectionId);
    }

    const { data: jobs, error } = await query;
    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];

    for (const job of (jobs || []) as PmsSyncQueueRow[]) {
      try {
        const { data: connection, error: connError } = await supabase
          .from('pms_connections')
          .select('id, pms_provider, sync_settings, is_active')
          .eq('id', job.pms_connection_id)
          .maybeSingle();

        if (connError || !connection || !connection.is_active) {
          await markQueueJobComplete(
            supabase,
            job.id,
            { skipped: true, reason: 'inactive or missing connection' },
            true
          );
          results.push({ jobId: job.id, skipped: true });
          continue;
        }

        const plan = await processJob(supabase, job, connection.pms_provider);
        results.push(plan);
      } catch (jobError) {
        const message = jobError instanceof Error ? jobError.message : 'Outbound job failed';
        await markQueueJobFailed(supabase, job.id, job.attempts + 1, message);
        results.push({ jobId: job.id, success: false, error: message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        outboundEnabled: isOwnerRezOutboundEnabled(),
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Outbound processor error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Outbound processor failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
