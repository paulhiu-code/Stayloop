import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildSampleVariables, renderTemplateString, type TemplateVariables } from '../_shared/email-template.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  isResendConfigured,
  sendEmailViaResend,
} from '../_shared/resend.ts';

type SendEmailRequest = {
  action?: 'health' | 'test' | 'preview' | 'send';
  trigger?: string;
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  variables?: TemplateVariables;
};

function jsonResponse(
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  status = 200
): Response {
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

async function isAdminRequest(req: Request): Promise<boolean> {
  if (isServiceRoleRequest(req)) return true;

  const url = getSupabaseUrl();
  const anonKey =
    Deno.env.get('STAYLOOP_SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!url || !anonKey || !token || token === anonKey) return false;

  const service = createServiceClient();
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) return false;

  const { data: profile } = await service
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .maybeSingle();

  return Boolean(profile?.is_admin);
}

async function loadTriggerTemplate(supabase: ReturnType<typeof createServiceClient>, triggerSlug: string) {
  const { data: trigger, error: triggerError } = await supabase
    .from('email_triggers')
    .select('id, slug, name, is_active, variables_schema')
    .eq('slug', triggerSlug)
    .maybeSingle();

  if (triggerError) throw triggerError;
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
    provider_message_id: entry.provider_message_id ?? null,
    error_message: entry.error_message ?? null,
    metadata: entry.metadata ?? {},
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    if (!(await isAdminRequest(req))) {
      return jsonResponse({ error: 'Unauthorized.' }, corsHeaders, 401);
    }

    return jsonResponse(
      {
        ok: true,
        configured: isResendConfigured(),
        provider: 'resend',
      },
      corsHeaders
    );
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, corsHeaders, 405);
  }

  let body: SendEmailRequest = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action ?? 'test';
  const authorized = await isAdminRequest(req);

  if (action === 'health') {
    return jsonResponse(
      {
        ok: isResendConfigured(),
        configured: isResendConfigured(),
        provider: 'resend',
      },
      corsHeaders
    );
  }

  if ((action === 'preview' || action === 'send') && !authorized) {
    return jsonResponse({ error: 'Unauthorized.' }, corsHeaders, 401);
  }

  if (action !== 'test' && action !== 'preview' && action !== 'send' && !isServiceRoleRequest(req)) {
    return jsonResponse({ error: 'Unauthorized.' }, corsHeaders, 401);
  }

  const supabase = createServiceClient();

  if (action === 'preview') {
    const triggerSlug = body.trigger?.trim();
    if (!triggerSlug) return jsonResponse({ error: 'Missing trigger slug.' }, corsHeaders, 400);

    try {
      const { trigger, template } = await loadTriggerTemplate(supabase, triggerSlug);
      const variables = {
        ...buildSampleVariables(trigger.variables_schema as Array<{ key: string; sample?: string }>),
        ...(body.variables ?? {}),
      };
      const subject = renderTemplateString(body.subject ?? template.subject, variables);
      const html = renderTemplateString(body.html ?? template.html_body, variables);
      const text = renderTemplateString(body.text ?? template.text_body, variables);

      return jsonResponse(
        {
          ok: true,
          trigger: trigger.slug,
          subject,
          html,
          text,
          variables,
        },
        corsHeaders
      );
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Preview failed.' }, corsHeaders, 400);
    }
  }

  if (action === 'send') {
    if (!isResendConfigured()) {
      return jsonResponse({ error: 'Resend is not configured.' }, corsHeaders, 503);
    }

    const triggerSlug = body.trigger?.trim();
    const to = body.to?.trim();
    if (!triggerSlug) return jsonResponse({ error: 'Missing trigger slug.' }, corsHeaders, 400);
    if (!to) return jsonResponse({ error: 'Missing recipient email.' }, corsHeaders, 400);

    try {
      const { trigger, template } = await loadTriggerTemplate(supabase, triggerSlug);
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
        tags: [{ name: 'trigger', value: triggerSlug }],
      });

      await logDelivery(supabase, {
        trigger_id: trigger.id,
        trigger_slug: trigger.slug,
        template_id: template.id,
        recipient: to,
        subject,
        status: 'sent',
        provider_message_id: result.id,
        metadata: {
          variables,
          version: template.version,
          dedupe_key: typeof variables.dedupe_key === 'string' ? variables.dedupe_key : null,
          booking_id: typeof variables.booking_id === 'string' ? variables.booking_id : null,
        },
      });

      return jsonResponse(
        {
          ok: true,
          messageId: result.id,
          trigger: trigger.slug,
          to,
          subject,
        },
        corsHeaders
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send email.';
      return jsonResponse({ error: message }, corsHeaders, 502);
    }
  }

  if (!isServiceRoleRequest(req) && !authorized) {
    return jsonResponse({ error: 'Unauthorized.' }, corsHeaders, 401);
  }

  if (!isResendConfigured()) {
    return jsonResponse({ error: 'Resend is not configured.' }, corsHeaders, 503);
  }

  const to = body.to?.trim();
  if (!to) return jsonResponse({ error: 'Missing "to" email address.' }, corsHeaders, 400);

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

    return jsonResponse(
      {
        ok: true,
        messageId: result.id,
        to,
      },
      corsHeaders
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email.';
    return jsonResponse({ error: message }, corsHeaders, 502);
  }
});
