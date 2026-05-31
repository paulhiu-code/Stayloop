export type EmailVariableDefinition = {
  key: string;
  label: string;
  sample?: string;
};

export type EmailTrigger = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  recipient_role: string;
  variables_schema: EmailVariableDefinition[];
  is_active: boolean;
  sort_order: number;
  updated_at: string;
};

export type EmailTemplate = {
  id: string;
  trigger_id: string;
  subject: string;
  html_body: string;
  text_body: string;
  preview_text: string;
  version: number;
  is_published: boolean;
  updated_at: string;
};

export type EmailTriggerWithTemplate = EmailTrigger & {
  email_templates: EmailTemplate[] | EmailTemplate | null;
};

export type EmailDeliveryLog = {
  id: string;
  trigger_slug: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed' | 'preview';
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string;
};

export type EmailSequence = {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
};

export type EmailSequenceStep = {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_interval: string;
  delay_anchor: 'trigger' | 'check_in' | 'check_out';
  is_active: boolean;
  email_triggers: Pick<EmailTrigger, 'slug' | 'name'>;
};

export const EMAIL_CATEGORIES = [
  'all',
  'booking',
  'onboarding',
  'payment',
  'referral',
  'messaging',
  'pms',
  'review',
] as const;

export function renderTemplateString(
  template: string,
  variables: Record<string, string | number | boolean | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

export function buildSampleVariables(
  schema: EmailVariableDefinition[] | null | undefined
): Record<string, string> {
  const defaults: Record<string, string> = {
    site_url: 'https://stay-loop.co',
    manage_booking_url: 'https://stay-loop.co/dashboard',
    message_host_url: 'https://stay-loop.co/dashboard',
    conversation_url: 'https://stay-loop.co/dashboard',
    pms_settings_url: 'https://stay-loop.co/dashboard',
    review_url: 'https://stay-loop.co/review/sample',
  };

  for (const item of schema ?? []) {
    if (item.sample) defaults[item.key] = item.sample;
  }

  return defaults;
}

export function getTemplateForTrigger(trigger: EmailTriggerWithTemplate): EmailTemplate | null {
  const value = trigger.email_templates;
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type EmailTriggerWiringStatus = 'live' | 'scheduled' | 'template';

export const EMAIL_TRIGGER_WIRING: Record<
  string,
  { status: EmailTriggerWiringStatus; detail: string; cadence?: string }
> = {
  'booking.confirmed.guest': {
    status: 'live',
    detail: 'Sent when Stripe payment confirms a booking.',
    cadence: 'Immediately on payment success',
  },
  'booking.confirmed.host': {
    status: 'live',
    detail: 'Sent to the host when a booking is confirmed.',
    cadence: 'Immediately on payment success',
  },
  'booking.payment.receipt': {
    status: 'live',
    detail: 'Guest payment receipt after successful checkout.',
    cadence: 'Immediately on payment success',
  },
  'booking.cancelled.guest': {
    status: 'live',
    detail: 'Sent when a pending booking payment fails or is canceled.',
    cadence: 'Immediately on cancellation',
  },
  'booking.cancelled.host': {
    status: 'live',
    detail: 'Notifies the host when a pending booking is canceled.',
    cadence: 'Immediately on cancellation',
  },
  'booking.reminder.checkin.guest': {
    status: 'scheduled',
    detail: 'Pre-arrival and day-of reminders from the booking lifecycle cron.',
    cadence: '48 hours before check-in, then morning of check-in (Airbnb-style)',
  },
  'review.request.guest': {
    status: 'scheduled',
    detail: 'Post-stay review request from the booking lifecycle cron.',
    cadence: '3 hours after checkout (Airbnb-style)',
  },
  'referral.commission.earned': {
    status: 'live',
    detail: 'Sent when referral commissions are calculated on booking confirm.',
    cadence: 'Immediately after booking confirmation',
  },
  'message.new.guest': {
    status: 'template',
    detail: 'Template ready. Wire when in-app messaging send API is live.',
    cadence: 'Within 1 hour of new message (Airbnb-style)',
  },
  'message.new.host': {
    status: 'template',
    detail: 'Template ready. Wire when in-app messaging send API is live.',
    cadence: 'Within 1 hour of new message (Airbnb-style)',
  },
  'pms.sync.failed': {
    status: 'live',
    detail: 'Sent when OwnerRez sync fails.',
    cadence: 'Immediately on sync failure',
  },
  'account.welcome.guest': {
    status: 'live',
    detail: 'Sent after guest signup when the welcome API is called.',
    cadence: 'Within 30 minutes of account creation',
  },
  'account.welcome.host': {
    status: 'live',
    detail: 'Sent after host signup when the welcome API is called.',
    cadence: 'Within 30 minutes of account creation',
  },
  'payout.sent.host': {
    status: 'live',
    detail: 'Sent when a host releases payout on a booking.',
    cadence: 'Immediately when payout is released',
  },
};

export function getTriggerWiring(slug: string) {
  return (
    EMAIL_TRIGGER_WIRING[slug] ?? {
      status: 'template' as const,
      detail: 'Template available. Automation not documented yet.',
    }
  );
}
