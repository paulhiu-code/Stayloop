import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildSampleVariables, renderTemplateString, type TemplateVariables } from '../_shared/email-template.ts';
import {
  getEmailFromAddress,
  getEmailReplyToAddress,
  isResendConfigured,
  sendEmailViaResend,
} from '../_shared/resend.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type SendEmailRequest = {
  action?: 'health' | 'test' | 'preview' | 'send';
  trigger?: string;
  hostId?: string;
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  variables?: TemplateVariables;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

function createServiceClient() {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();
  if (!url || !key) throw new Error('Missing Supabase service credentials.');
  return createClient(url, key);
}

function isServiceRoleRequest(req: Request): boolean {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return false;
  const authHeader = req.headers.get('Authorization') ?? '';
  const apiKeyHeader = req.headers.get('apikey') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === serviceRoleKey || apiKeyHeader === serviceRoleKey;
}

type AuthContext = {
  authorized: boolean;
  userId: string | null;
  isAdmin: boolean;
  isHost: boolean;
};

async function getAuthContext(req: Request): Promise<AuthContext> {
  if (isServiceRoleRequest(req)) {
    return { authorized: true, userId: null, isAdmin: true, isHost: false };
  }

  const url = getSupabaseUrl();
  const anonKey =
    Deno.env.get('STAYLOOP_SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!url || !anonKey || !token || token === anonKey) {
    return { authorized: false, userId: null, isAdmin: false, isHost: false };
  }

  const service = createServiceClient();
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) {
    return { authorized: false, userId: null, isAdmin: false, isHost: false };
  }

  const { data: profile } = await service
    .from('profiles')
    .select('is_admin, user_type')
    .eq('id', userData.user.id)
    .maybeSingle();

  const isAdmin = Boolean(profile?.is_admin);
  const isHost = profile?.user_type === 'host' || profile?.user_type === 'both';

  return {
    authorized: isAdmin || isHost,
    userId: userData.user.id,
    isAdmin,
    isHost,
  };
}

function canManageHostEmails(auth: AuthContext, hostId?: string): boolean {
  if (!auth.authorized) return false;
  if (auth.isAdmin || !hostId) return auth.isAdmin;
  return auth.isHost && auth.userId === hostId;
}

async function loadTriggerTemplate(
  supabase: ReturnType<typeof createServiceClient>,
  triggerSlug: string,
  hostId?: string
) {
  let trigger:
    | {
        id: string;
        slug: string;
        name: string;
        is_active: boolean;
        variables_schema: unknown;
        host_id?: string | null;
        platform_trigger_slug?: string | null;
      }
    | null = null;

  if (hostId) {
    const { data: hostOverride, error: hostError } = await supabase
      .from('email_triggers')
      .select('id, slug, name, is_active, variables_schema, host_id, platform_trigger_slug')
      .eq('host_id', hostId)
      .eq('platform_trigger_slug', triggerSlug)
      .maybeSingle();

    if (hostError) throw hostError;
    if (hostOverride) {
      if (!hostOverride.is_active) {
        throw new Error(`Host email trigger is disabled: ${triggerSlug}`);
      }
      trigger = hostOverride;
    }

    if (!trigger) {
      const { data: hostCustom, error: customError } = await supabase
        .from('email_triggers')
        .select('id, slug, name, is_active, variables_schema, host_id, platform_trigger_slug')
        .eq('host_id', hostId)
        .eq('slug', triggerSlug)
        .maybeSingle();

      if (customError) throw customError;
      if (hostCustom) {
        if (!hostCustom.is_active) {
          throw new Error(`Host email trigger is disabled: ${triggerSlug}`);
        }
        trigger = hostCustom;
      }
    }
  }

  if (!trigger) {
    const { data: platformTrigger, error: triggerError } = await supabase
      .from('email_triggers')
      .select('id, slug, name, is_active, variables_schema, host_id')
      .eq('slug', triggerSlug)
      .is('host_id', null)
      .maybeSingle();

    if (triggerError) throw triggerError;
    trigger = platformTrigger;
  }

  if (!trigger) throw new Error(`Unknown email trigger: ${triggerSlug}`);
  if (!trigger.is_active) throw new Error(`Email trigger is disabled: ${triggerSlug}`);

  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('id, subject, html_body, text_body, preview_text, version')
    .eq('trigger_id', trigger.id)
    .eq('is_published', true)
    .maybeSingle();

  if (templateError) throw templateError;
  if (!template) throw new Error(`No published template for trigger: ${triggerSlug}`);

  return { trigger, template };
}

async function logDelivery(
  supabase: ReturnType<typeof createServiceClient>,
  entry: {
    trigger_id: string;
    trigger_slug: string;
    template_id: string;
    recipient: string;
    subject: string;
    status: 'sent' | 'failed' | 'preview';
    host_id?: string | null;
    provider_message_id?: string | null;
    error_message?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from('email_delivery_log').insert({
    trigger_id: entry.trigger_id,
    trigger_slug: entry.trigger_slug,
    template_id: entry.template_id,
    recipient: entry.recipient,
    subject: entry.subject,
    status: entry.status,
    host_id: entry.host_id ?? null,
    provider_message_id: entry.provider_message_id ?? null,
    error_message: entry.error_message ?? null,
    metadata: entry.metadata ?? {},
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonResponse({
      ok: true,
      configured: isResendConfigured(),
      from: getEmailFromAddress(),
      replyTo: getEmailReplyToAddress() ?? null,
      provider: 'resend',
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let body: SendEmailRequest = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action ?? 'test';
  const auth = await getAuthContext(req);
  const hostId = body.hostId?.trim() || undefined;

  if (action === 'health') {
    return jsonResponse({
      ok: isResendConfigured(),
      configured: isResendConfigured(),
      from: getEmailFromAddress(),
      replyTo: getEmailReplyToAddress() ?? null,
      provider: 'resend',
    });
  }

  if ((action === 'preview' || action === 'send') && !canManageHostEmails(auth, hostId)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  if (action !== 'test' && action !== 'preview' && action !== 'send' && !isServiceRoleRequest(req)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const supabase = createServiceClient();

  if (action === 'preview') {
    const triggerSlug = body.trigger?.trim();
    if (!triggerSlug) return jsonResponse({ error: 'Missing trigger slug.' }, 400);

    try {
      const { trigger, template } = await loadTriggerTemplate(supabase, triggerSlug, hostId);
      const variables = {
        ...buildSampleVariables(trigger.variables_schema as Array<{ key: string; sample?: string }>),
        ...(body.variables ?? {}),
      };
      const subject = renderTemplateString(body.subject ?? template.subject, variables);
      const html = renderTemplateString(body.html ?? template.html_body, variables);
      const text = renderTemplateString(body.text ?? template.text_body, variables);

      return jsonResponse({
        ok: true,
        trigger: trigger.slug,
        hostId: trigger.host_id ?? null,
        subject,
        html,
        text,
        variables,
      });
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Preview failed.' }, 400);
    }
  }

  if (action === 'send') {
    if (!isResendConfigured()) {
      return jsonResponse({ error: 'Resend is not configured.' }, 503);
    }

    const triggerSlug = body.trigger?.trim();
    const to = body.to?.trim();
    if (!triggerSlug) return jsonResponse({ error: 'Missing trigger slug.' }, 400);
    if (!to) return jsonResponse({ error: 'Missing recipient email.' }, 400);

    try {
      const { trigger, template } = await loadTriggerTemplate(supabase, triggerSlug, hostId);
      const variables = {
        ...buildSampleVariables(trigger.variables_schema as Array<{ key: string; sample?: string }>),
        ...(body.variables ?? {}),
      };
      const subject = renderTemplateString(body.subject ?? template.subject, variables);
      const html = renderTemplateString(body.html ?? template.html_body, variables);
      const text = renderTemplateString(body.text ?? template.text_body, variables);

      const result = await sendEmailViaResend({
        to,
        subject,
        html,
        text,
        tags: [
          { name: 'trigger', value: triggerSlug },
          ...(hostId ? [{ name: 'host_id', value: hostId }] : []),
        ],
      });

      await logDelivery(supabase, {
        trigger_id: trigger.id,
        trigger_slug: trigger.platform_trigger_slug ?? trigger.slug,
        template_id: template.id,
        recipient: to,
        subject,
        status: 'sent',
        host_id: trigger.host_id ?? hostId ?? null,
        provider_message_id: result.id,
        metadata: {
          variables,
          version: template.version,
          dedupe_key: typeof variables.dedupe_key === 'string' ? variables.dedupe_key : null,
          booking_id: typeof variables.booking_id === 'string' ? variables.booking_id : null,
          host_id: trigger.host_id ?? hostId ?? null,
        },
      });

      return jsonResponse({
        ok: true,
        messageId: result.id,
        trigger: trigger.slug,
        hostId: trigger.host_id ?? hostId ?? null,
        to,
        subject,
        from: getEmailFromAddress(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send email.';
      return jsonResponse({ error: message }, 502);
    }
  }

  if (!isServiceRoleRequest(req) && !auth.authorized) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  if (!isResendConfigured()) {
    return jsonResponse({ error: 'Resend is not configured.' }, 503);
  }

  const to = body.to?.trim();
  if (!to) return jsonResponse({ error: 'Missing "to" email address.' }, 400);

  const subject = body.subject?.trim() || 'StayLoop email connection test';
  const html =
    body.html?.trim() ||
    `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;"><h1>StayLoop email connection test</h1><p>Your Resend integration is connected and sending successfully.</p></div>`;
  const text = body.text?.trim() || 'StayLoop email connection test';

  try {
    const result = await sendEmailViaResend({
      to,
      subject,
      html,
      text,
      tags: [{ name: 'category', value: 'connection_test' }],
    });

    return jsonResponse({
      ok: true,
      messageId: result.id,
      to,
      from: getEmailFromAddress(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email.';
    return jsonResponse({ error: message }, 502);
  }
});
