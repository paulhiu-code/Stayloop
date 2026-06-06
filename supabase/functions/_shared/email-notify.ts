import { sendEmailViaResend, isResendConfigured } from './resend.ts';

function getServiceRoleKey(): string | undefined {
  return (
    Deno.env.get('STAYLOOP_SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    undefined
  );
}

function getSupabaseUrl(): string | undefined {
  return Deno.env.get('STAYLOOP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL') ?? undefined;
}

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://stay-loop.co').replace(/\/$/, '');

export async function notifyPmsSyncFailure(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { email?: string; full_name?: string | null } | null }>;
        };
      };
    };
  },
  {
    hostUserId,
    pmsProvider,
    syncError,
  }: {
    hostUserId: string;
    pmsProvider: string;
    syncError: string;
  }
) {
  const url = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!url || !serviceRoleKey) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', hostUserId)
    .maybeSingle();

  if (!profile?.email) return;

  await fetch(`${url}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'send',
      trigger: 'pms.sync.failed',
      hostId: hostUserId,
      to: profile.email,
      variables: {
        host_name: profile.full_name || 'Host',
        pms_provider: pmsProvider,
        sync_error: syncError.slice(0, 500),
        pms_settings_url: `${SITE_URL}/dashboard`,
        site_url: SITE_URL,
        dedupe_key: `pms-sync:${hostUserId}:${new Date().toISOString().slice(0, 13)}`,
      },
    }),
  }).catch((error) => {
    console.error('Failed to send PMS sync failure email:', error);
  });
}

export { isResendConfigured, sendEmailViaResend };
