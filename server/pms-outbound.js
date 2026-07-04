/*
  Fire-and-forget trigger that pushes a confirmed StayLoop booking out to any
  connected PMS (OwnerRez / Guesty / Hostaway) via the pms-push-reservation Edge
  Function. Runs with the Supabase service role. Failures are logged, never thrown,
  so booking confirmation + emails are never blocked by PMS sync.
*/

function resolveSupabaseUrl() {
  const url = process.env.SUPABASE_URL || process.env.STAYLOOP_SUPABASE_URL || '';
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

function resolveServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.STAYLOOP_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
}

export async function pushBookingToPms(bookingId) {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    // Not configured (e.g. local dev without a service role key) — skip quietly.
    return { skipped: true, reason: 'missing_supabase_service_role' };
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/pms-push-reservation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'push_booking', bookingId }),
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    throw new Error(
      (payload && payload.error) || `pms-push-reservation failed (${response.status})`
    );
  }

  return payload;
}

// Never blocks the caller; logs outcome for observability.
export function triggerPmsOutboundPush(bookingId) {
  pushBookingToPms(bookingId)
    .then((result) => {
      if (result && result.skipped) return;
      const pushed = result && typeof result.pushed === 'number' ? result.pushed : 0;
      console.log(`PMS outbound push for booking ${bookingId}: ${pushed} connection(s)`);
    })
    .catch((error) => {
      console.error(`PMS outbound push failed for booking ${bookingId}:`, error.message || error);
    });
}
