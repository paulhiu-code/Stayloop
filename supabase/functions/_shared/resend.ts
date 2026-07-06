export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
};

export type SendEmailResult = {
  id: string;
};

type ResendErrorResponse = {
  message?: string;
  name?: string;
};

function getResendApiKey(): string {
  const apiKey =
    Deno.env.get('RESEND_API_KEY') ??
    Deno.env.get('STAYLOOP_RESEND_API_KEY');

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable.');
  }

  return apiKey;
}

export function getEmailFromAddress(): string {
  return (
    Deno.env.get('EMAIL_FROM') ??
    Deno.env.get('STAYLOOP_EMAIL_FROM') ??
    'StayLoop <onboarding@resend.dev>'
  );
}

export function getEmailReplyToAddress(): string | undefined {
  return (
    Deno.env.get('EMAIL_REPLY_TO') ??
    Deno.env.get('STAYLOOP_EMAIL_REPLY_TO') ??
    'paul.hiu@gmail.com'
  );
}

export async function sendEmailViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = getResendApiKey();
  const from = getEmailFromAddress();
  const replyTo = input.replyTo ?? getEmailReplyToAddress();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: replyTo,
      tags: input.tags,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const error = payload as ResendErrorResponse;
    throw new Error(error.message ?? `Resend request failed with status ${response.status}.`);
  }

  return payload as SendEmailResult;
}

export function isResendConfigured(): boolean {
  return Boolean(
    Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('STAYLOOP_RESEND_API_KEY')
  );
}
