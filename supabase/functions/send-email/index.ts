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
  action?: 'health' | 'test';
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getAuthorizedCaller(req: Request): boolean {
  const serviceRoleKey =
    Deno.env.get('STAYLOOP_SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!serviceRoleKey) {
    return false;
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const apiKeyHeader = req.headers.get('apikey') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  return token === serviceRoleKey || apiKeyHeader === serviceRoleKey;
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

  if (!getAuthorizedCaller(req)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  let body: SendEmailRequest = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action ?? 'test';

  if (action === 'health') {
    return jsonResponse({
      ok: isResendConfigured(),
      configured: isResendConfigured(),
      from: getEmailFromAddress(),
      replyTo: getEmailReplyToAddress() ?? null,
      provider: 'resend',
    });
  }

  if (!isResendConfigured()) {
    return jsonResponse(
      {
        error: 'Resend is not configured. Set RESEND_API_KEY in Supabase Edge Function secrets.',
      },
      503
    );
  }

  const to = body.to?.trim();
  if (!to) {
    return jsonResponse({ error: 'Missing "to" email address.' }, 400);
  }

  const subject = body.subject?.trim() || 'StayLoop email connection test';
  const html =
    body.html?.trim() ||
    `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h1 style="margin-bottom: 12px;">StayLoop email connection test</h1>
        <p>Your Resend integration is connected and sending successfully.</p>
        <p style="color: #6b7280; font-size: 14px;">Sent at ${new Date().toISOString()}</p>
      </div>
    `.trim();
  const text =
    body.text?.trim() ||
    'StayLoop email connection test\n\nYour Resend integration is connected and sending successfully.';

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
