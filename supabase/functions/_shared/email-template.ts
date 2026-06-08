export type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplateString(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return escapeHtml(String(value));
  });
}

export function buildSampleVariables(
  schema: Array<{ key: string; sample?: string }> | null | undefined
): TemplateVariables {
  const defaults: TemplateVariables = {
    site_url: 'https://stay-loop.co',
    manage_booking_url: 'https://stay-loop.co/dashboard',
    message_host_url: 'https://stay-loop.co/dashboard',
    conversation_url: 'https://stay-loop.co/dashboard',
    pms_settings_url: 'https://stay-loop.co/dashboard',
    review_url: 'https://stay-loop.co/review/sample',
  };

  for (const item of schema ?? []) {
    if (item.sample) {
      defaults[item.key] = item.sample;
    }
  }

  return defaults;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
