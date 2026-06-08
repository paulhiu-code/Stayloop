import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, x-stayloop-signature',
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

function resolveWebhookSecret(connection: Record<string, unknown>): string {
  const direct = connection.webhook_secret;
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }

  const credentials = connection.api_credentials as Record<string, unknown> | null;
  const nested = credentials?.webhook_secret;
  if (typeof nested === 'string' && nested.length > 0) {
    return nested;
  }

  return '';
}

async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('sha256', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  return provided === expected;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const supabaseUrl = Deno.env.get('STAYLOOP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = getServiceRoleKey()!;

    const rawBody = await req.text();
    const webhookData = rawBody ? JSON.parse(rawBody) : {};

    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    const connectionId = url.searchParams.get('connection_id');

    if (!provider || !connectionId) {
      return new Response(
        JSON.stringify({ error: 'Missing provider or connection_id query parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: connection, error: connError } = await supabase
      .from('pms_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('pms_provider', provider)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive connection' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookSecret = resolveWebhookSecret(connection as Record<string, unknown>);
    const signature = req.headers.get('x-stayloop-signature');
    if (!(await verifyWebhookSignature(rawBody, signature, webhookSecret))) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const syncFunctionName = provider === 'ownerrez' ? 'pms-ownerrez-sync' : 'pms-guesty-sync';

    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/${syncFunctionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'webhook',
        pmsConnectionId: connectionId,
        webhookData,
      }),
    });

    const raw = await syncResponse.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { raw };
    }

    if (!syncResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: typeof payload?.error === 'string' ? payload.error : 'Webhook sync failed',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed', result: payload?.result ?? payload }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook receiver error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Webhook receiver failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
