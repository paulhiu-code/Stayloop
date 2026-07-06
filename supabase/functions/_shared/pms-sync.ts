import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in'] as const;

export type OutboundJobAction = 'create' | 'update' | 'cancel' | 'block_dates' | 'unblock_dates';
export type OutboundEntityType = 'booking' | 'availability' | 'property' | 'pricing';

export type PmsSyncQueueRow = {
  id: string;
  pms_connection_id: string;
  entity_type: OutboundEntityType;
  entity_id: string | null;
  action: OutboundJobAction;
  direction: 'to_pms' | 'from_pms';
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  attempts: number;
  dry_run?: boolean;
};

export function isOwnerRezOutboundEnabled(): boolean {
  const flag = Deno.env.get('OWNERREZ_OUTBOUND_ENABLED');
  return flag === 'true' || flag === '1';
}

export function buildOwnerRezOutboundPlan(
  job: PmsSyncQueueRow,
  provider: string
): Record<string, unknown> {
  const payload = job.payload || {};
  const dryRun = job.dry_run !== false && !isOwnerRezOutboundEnabled();

  if (provider !== 'ownerrez') {
    return {
      jobId: job.id,
      action: job.action,
      provider,
      dryRun: true,
      simulated: true,
      message: `Outbound for ${provider} is not implemented yet; job recorded only.`,
      payload,
    };
  }

  let wouldCall = '';
  switch (job.action) {
    case 'create':
      wouldCall = 'POST /v2/bookings';
      break;
    case 'update':
      wouldCall = 'PATCH /v2/bookings/{id}';
      break;
    case 'cancel':
      wouldCall = 'PATCH /v2/bookings/{id} (status=canceled)';
      break;
    default:
      wouldCall = 'OwnerRez calendar or booking API';
  }

  if (dryRun) {
    return {
      jobId: job.id,
      action: job.action,
      provider,
      dryRun: true,
      simulated: true,
      message:
        'Outbound disabled (OWNERREZ_OUTBOUND_ENABLED=false). Job logged; no OwnerRez API call made.',
      wouldCall,
      payload,
    };
  }

  return {
    jobId: job.id,
    action: job.action,
    provider,
    dryRun: false,
    simulated: false,
    message: 'Outbound enabled but live OwnerRez writes are not wired in this release.',
    wouldCall,
    payload,
  };
}

export async function markQueueJobComplete(
  supabase: SupabaseClient,
  jobId: string,
  result: Record<string, unknown>,
  dryRun: boolean
) {
  const { error } = await supabase
    .from('pms_sync_queue')
    .update({
      status: 'completed',
      dry_run: dryRun,
      result,
      processed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) throw error;
}

export async function markQueueJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  attempts: number,
  message: string
) {
  const status = attempts >= 5 ? 'failed' : 'pending';
  const { error } = await supabase
    .from('pms_sync_queue')
    .update({
      status,
      attempts,
      last_error: message,
      scheduled_for:
        status === 'pending'
          ? new Date(Date.now() + Math.min(attempts, 5) * 60_000).toISOString()
          : undefined,
    })
    .eq('id', jobId);

  if (error) throw error;
}

export async function updateBookingMappingAfterOutbound(
  supabase: SupabaseClient,
  connectionId: string,
  stayloopBookingId: string,
  syncStatus: 'dry_run' | 'synced' | 'pending' | 'failed'
) {
  const { error } = await supabase
    .from('pms_booking_mappings')
    .update({
      sync_status: syncStatus,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('pms_connection_id', connectionId)
    .eq('stayloop_booking_id', stayloopBookingId);

  if (error) throw error;
}
