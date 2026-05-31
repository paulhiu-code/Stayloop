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
