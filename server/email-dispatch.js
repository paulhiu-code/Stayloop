const SITE_URL = (process.env.SITE_URL || 'https://stay-loop.co').replace(/\/$/, '');

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function confirmationCode(bookingId) {
  return `SL-${String(bookingId).replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export async function wasEmailSent(pool, { triggerSlug, dedupeKey }) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM email_delivery_log
     WHERE trigger_slug = $1
       AND (
         metadata->>'dedupe_key' = $2
         OR metadata->'variables'->>'dedupe_key' = $2
       )
       AND status = 'sent'
     LIMIT 1`,
    [triggerSlug, dedupeKey]
  );

  return rows.length > 0;
}

export async function sendTriggerEmail({ trigger, to, variables }) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to send emails.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'send',
      trigger,
      to,
      variables: {
        ...variables,
        site_url: variables.site_url || SITE_URL,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `send-email failed with ${response.status}`);
  }

  return payload;
}

export async function dispatchTrigger(pool, { triggerSlug, to, variables, dedupeKey }) {
  if (!to) return { skipped: true, reason: 'missing_recipient' };

  const alreadySent = await wasEmailSent(pool, { triggerSlug, dedupeKey });
  if (alreadySent) return { skipped: true, reason: 'already_sent' };

  const result = await sendTriggerEmail({
    trigger: triggerSlug,
    to,
    variables: {
      ...variables,
      dedupe_key: dedupeKey,
    },
  });

  return { skipped: false, messageId: result.messageId };
}

export function bookingDedupeKey(bookingId, triggerSlug, suffix = '') {
  return `booking:${bookingId}:${triggerSlug}${suffix ? `:${suffix}` : ''}`;
}

export function accountDedupeKey(userId, triggerSlug) {
  return `account:${userId}:${triggerSlug}`;
}

export function parseDelayInterval(interval) {
  const normalized = String(interval || '0 seconds').trim();
  const match = normalized.match(/^(-?\d+)\s+(second|seconds|minute|minutes|hour|hours|day|days)$/i);
  if (!match) return { amount: 0, unit: 'day' };
  const unit = match[2].toLowerCase().replace(/s$/, '');
  return { amount: Number.parseInt(match[1], 10), unit };
}

export function addInterval(baseDate, interval) {
  const { amount, unit } = parseDelayInterval(interval);
  const date = new Date(baseDate);
  if (Number.isNaN(date.getTime())) return null;

  switch (unit) {
    case 'second':
      date.setUTCSeconds(date.getUTCSeconds() + amount);
      break;
    case 'minute':
      date.setUTCMinutes(date.getUTCMinutes() + amount);
      break;
    case 'hour':
      date.setUTCHours(date.getUTCHours() + amount);
      break;
    case 'day':
    default:
      date.setUTCDate(date.getUTCDate() + amount);
      break;
  }

  return date;
}

export function anchorDateTime(booking, anchor) {
  const checkIn = booking.check_in_date || booking.check_in;
  const checkOut = booking.check_out_date || booking.check_out;

  if (anchor === 'check_in' && checkIn) {
    return new Date(`${checkIn}T15:00:00.000Z`);
  }

  if (anchor === 'check_out' && checkOut) {
    return new Date(`${checkOut}T16:00:00.000Z`);
  }

  if (booking.confirmed_at) {
    return new Date(booking.confirmed_at);
  }

  return booking.updated_at ? new Date(booking.updated_at) : new Date();
}

export { SITE_URL };
