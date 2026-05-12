import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse webhook data
    const webhookData = await req.json();

    // Extract PMS provider from URL or headers
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    const connectionId = url.searchParams.get('connection_id');

    if (!provider || !connectionId) {
      return new Response(
        JSON.stringify({ error: 'Missing provider or connection_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify connection exists
    const { data: connection, error: connError } = await supabase
      .from('pms_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('pms_provider', provider)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Invalid connection' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store webhook event
    await supabase.from('pms_webhook_events').insert({
      pms_connection_id: connectionId,
      event_type: webhookData.event || webhookData.type || 'unknown',
      event_data: webhookData,
      processed: false,
    });

    // Trigger appropriate sync function based on event type
    const eventType = webhookData.event || webhookData.type || '';

    if (eventType.includes('booking') || eventType.includes('reservation')) {
      // Trigger booking sync
      const syncUrl = provider === 'ownerrez'
        ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/pms-ownerrez-sync`
        : `${Deno.env.get('SUPABASE_URL')}/functions/v1/pms-guesty-sync`;

      await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          action: 'webhook',
          pmsConnectionId: connectionId,
          webhookData,
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook received' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook receiver error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
