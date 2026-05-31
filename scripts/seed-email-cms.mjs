#!/usr/bin/env node
/**
 * Seed StayLoop Email CMS triggers and starter templates via Supabase REST.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-email-cms.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadDotEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function rest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

function layout(heading, bodyHtml, previewText, ctaLabel, ctaUrl) {
  const cta = ctaLabel && ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;"><tr><td align="center" style="border-radius:14px;background:linear-gradient(135deg,#f97316,#f43f5e);"><a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;">${ctaLabel}</a></td></tr></table>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title></head><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previewText || heading}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.08);"><tr><td style="padding:28px 32px;background:linear-gradient(135deg,#fff7ed,#fff1f2);border-bottom:1px solid #fed7aa;"><div style="font-size:13px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#ea580c;">StayLoop</div><h1 style="margin:12px 0 0;font-size:28px;line-height:1.25;color:#0f172a;">${heading}</h1></td></tr><tr><td style="padding:32px;font-size:16px;line-height:1.7;color:#334155;">${bodyHtml}${cta}</td></tr><tr><td style="padding:0 32px 32px;font-size:14px;line-height:1.6;color:#64748b;border-top:1px solid #f1f5f9;"><p style="margin:24px 0 8px;">Need help? Reply to this email or visit <a href="{{site_url}}" style="color:#ea580c;">stay-loop.co</a>.</p><p style="margin:0;">© StayLoop · Memorable stays with clear pricing</p></td></tr></table></td></tr></table></body></html>`;
}

const triggers = [
  ['booking.confirmed.guest', 'Booking confirmed (guest)', 'Sent when a booking is confirmed after payment or host acceptance.', 'booking', 'guest', 10, [{ key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'check_in_date', label: 'Check-in date', sample: 'June 12, 2026' }, { key: 'check_out_date', label: 'Check-out date', sample: 'June 16, 2026' }, { key: 'num_guests', label: 'Guest count', sample: '4' }, { key: 'total_amount', label: 'Total paid', sample: '$1,248.00' }, { key: 'confirmation_code', label: 'Confirmation code', sample: 'SL-8F2K91' }, { key: 'manage_booking_url', label: 'Manage booking URL', sample: 'https://stay-loop.co/dashboard' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['booking.confirmed.host', 'Booking confirmed (host)', 'Notifies the host of a new confirmed reservation.', 'booking', 'host', 11, [{ key: 'host_name', label: 'Host name', sample: 'Playpark Vacations' }, { key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'check_in_date', label: 'Check-in date', sample: 'June 12, 2026' }, { key: 'check_out_date', label: 'Check-out date', sample: 'June 16, 2026' }, { key: 'host_payout', label: 'Host payout', sample: '$1,023.20' }, { key: 'manage_booking_url', label: 'Manage booking URL', sample: 'https://stay-loop.co/dashboard' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['booking.payment.receipt', 'Payment receipt', 'Receipt after successful guest payment.', 'booking', 'guest', 12, [{ key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'total_amount', label: 'Total paid', sample: '$1,248.00' }, { key: 'payment_date', label: 'Payment date', sample: 'May 31, 2026' }, { key: 'confirmation_code', label: 'Confirmation code', sample: 'SL-8F2K91' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['booking.cancelled.guest', 'Booking cancelled (guest)', 'Sent when a booking is cancelled.', 'booking', 'guest', 20, [{ key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'check_in_date', label: 'Check-in date', sample: 'June 12, 2026' }, { key: 'refund_amount', label: 'Refund amount', sample: '$1,248.00' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['booking.cancelled.host', 'Booking cancelled (host)', 'Notifies host that a reservation was cancelled.', 'booking', 'host', 21, [{ key: 'host_name', label: 'Host name', sample: 'Playpark Vacations' }, { key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'check_in_date', label: 'Check-in date', sample: 'June 12, 2026' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['booking.reminder.checkin.guest', 'Check-in reminder', 'Reminder before guest arrival.', 'booking', 'guest', 30, [{ key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'check_in_date', label: 'Check-in date', sample: 'June 12, 2026' }, { key: 'check_in_instructions', label: 'Check-in instructions', sample: 'Use lockbox code 4821.' }, { key: 'message_host_url', label: 'Message host URL', sample: 'https://stay-loop.co/dashboard' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['review.request.guest', 'Review request', 'Ask guest to review after checkout.', 'review', 'guest', 40, [{ key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'review_url', label: 'Review URL', sample: 'https://stay-loop.co/review/abc123' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['referral.commission.earned', 'Referral commission earned', 'Sent when a referral commission is calculated.', 'referral', 'host', 50, [{ key: 'host_name', label: 'Earner name', sample: 'Playpark Vacations' }, { key: 'referral_amount', label: 'Commission amount', sample: '$42.50' }, { key: 'referral_level', label: 'Referral level', sample: 'Level 1' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['message.new.guest', 'New message (guest)', 'Email alert for a new host message.', 'messaging', 'guest', 60, [{ key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'host_name', label: 'Host name', sample: 'Playpark Vacations' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'message_preview', label: 'Message preview', sample: 'Hi Alex, check-in is anytime after 4 PM.' }, { key: 'conversation_url', label: 'Conversation URL', sample: 'https://stay-loop.co/dashboard' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['message.new.host', 'New message (host)', 'Email alert for a new guest message.', 'messaging', 'host', 61, [{ key: 'host_name', label: 'Host name', sample: 'Playpark Vacations' }, { key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'message_preview', label: 'Message preview', sample: 'We will arrive around 5:30 PM.' }, { key: 'conversation_url', label: 'Conversation URL', sample: 'https://stay-loop.co/dashboard' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['pms.sync.failed', 'PMS sync failed', 'Alert host when PMS sync fails.', 'pms', 'host', 70, [{ key: 'host_name', label: 'Host name', sample: 'Playpark Vacations' }, { key: 'pms_provider', label: 'PMS provider', sample: 'OwnerRez' }, { key: 'sync_error', label: 'Error summary', sample: 'Calendar sync timed out for 2 properties.' }, { key: 'pms_settings_url', label: 'PMS settings URL', sample: 'https://stay-loop.co/dashboard' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['account.welcome.guest', 'Welcome (guest)', 'Welcome email after account verification.', 'onboarding', 'guest', 80, [{ key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['account.welcome.host', 'Welcome (host)', 'Welcome email for new hosts.', 'onboarding', 'host', 81, [{ key: 'host_name', label: 'Host name', sample: 'Playpark Vacations' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
  ['payout.sent.host', 'Payout sent', 'Confirms host payout was released.', 'payment', 'host', 90, [{ key: 'host_name', label: 'Host name', sample: 'Playpark Vacations' }, { key: 'payout_amount', label: 'Payout amount', sample: '$1,023.20' }, { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' }, { key: 'payout_date', label: 'Payout date', sample: 'June 13, 2026' }, { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' }]],
];

const templates = {
  'booking.confirmed.guest': {
    subject: 'Your StayLoop trip is confirmed',
    heading: 'Your trip is confirmed',
    preview: 'Your reservation is locked in. We are excited for your stay at {{property_title}}.',
    body: '<p>Hi {{guest_name}},</p><p>Your reservation is confirmed for <strong>{{property_title}}</strong>.</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;width:100%;background:#f8fafc;border-radius:16px;"><tr><td style="padding:18px 20px;font-size:15px;line-height:1.7;color:#334155;"><strong>Check-in:</strong> {{check_in_date}}<br><strong>Check-out:</strong> {{check_out_date}}<br><strong>Guests:</strong> {{num_guests}}<br><strong>Total:</strong> {{total_amount}}<br><strong>Confirmation:</strong> {{confirmation_code}}</td></tr></table><p>We will send check-in details closer to arrival.</p>',
    ctaLabel: 'View trip details',
    ctaUrl: '{{manage_booking_url}}',
    text: 'Hi {{guest_name}},\n\nYour StayLoop booking is confirmed.\n\nProperty: {{property_title}}\nCheck-in: {{check_in_date}}\nCheck-out: {{check_out_date}}\nGuests: {{num_guests}}\nTotal: {{total_amount}}\nConfirmation: {{confirmation_code}}\n\nView trip: {{manage_booking_url}}',
  },
  'booking.confirmed.host': {
    subject: 'New StayLoop booking for {{property_title}}',
    heading: 'New booking received',
    preview: 'You have a new confirmed reservation on StayLoop.',
    body: '<p>Hi {{host_name}},</p><p>You received a new confirmed booking for <strong>{{property_title}}</strong>.</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;width:100%;background:#f8fafc;border-radius:16px;"><tr><td style="padding:18px 20px;font-size:15px;line-height:1.7;color:#334155;"><strong>Guest:</strong> {{guest_name}}<br><strong>Check-in:</strong> {{check_in_date}}<br><strong>Check-out:</strong> {{check_out_date}}<br><strong>Estimated payout:</strong> {{host_payout}}</td></tr></table>',
    ctaLabel: 'Review booking',
    ctaUrl: '{{manage_booking_url}}',
    text: 'Hi {{host_name}},\n\nYou received a new confirmed booking for {{property_title}}.',
  },
  'booking.payment.receipt': {
    subject: 'StayLoop payment receipt',
    heading: 'Payment receipt',
    preview: 'Thanks for your payment. Here is your receipt for {{property_title}}.',
    body: '<p>Hi {{guest_name}},</p><p>Thanks for your payment for <strong>{{property_title}}</strong>.</p><p><strong>Amount paid:</strong> {{total_amount}}<br><strong>Payment date:</strong> {{payment_date}}<br><strong>Confirmation:</strong> {{confirmation_code}}</p>',
    text: 'Hi {{guest_name}},\n\nPayment received: {{total_amount}}',
  },
  'booking.cancelled.guest': {
    subject: 'Your StayLoop booking was cancelled',
    heading: 'Booking cancelled',
    preview: 'Your reservation for {{property_title}} has been cancelled.',
    body: '<p>Hi {{guest_name}},</p><p>Your reservation for <strong>{{property_title}}</strong> starting {{check_in_date}} has been cancelled.</p><p><strong>Refund amount:</strong> {{refund_amount}}</p>',
    ctaLabel: 'Browse stays',
    ctaUrl: '{{site_url}}',
    text: 'Hi {{guest_name}},\n\nYour booking for {{property_title}} was cancelled.',
  },
  'booking.cancelled.host': {
    subject: 'A StayLoop booking was cancelled',
    heading: 'Booking cancelled',
    preview: 'A reservation for {{property_title}} has been cancelled.',
    body: '<p>Hi {{host_name}},</p><p>The booking for <strong>{{property_title}}</strong> with guest {{guest_name}} on {{check_in_date}} has been cancelled.</p>',
    ctaLabel: 'Open dashboard',
    ctaUrl: '{{site_url}}',
    text: 'Hi {{host_name}},\n\nThe booking for {{property_title}} was cancelled.',
  },
  'booking.reminder.checkin.guest': {
    subject: 'Your StayLoop check-in is coming up',
    heading: 'Check-in reminder',
    preview: 'Your stay at {{property_title}} begins on {{check_in_date}}.',
    body: '<p>Hi {{guest_name}},</p><p>Your stay at <strong>{{property_title}}</strong> begins on {{check_in_date}}.</p><p><strong>Check-in instructions</strong><br>{{check_in_instructions}}</p>',
    ctaLabel: 'Message your host',
    ctaUrl: '{{message_host_url}}',
    text: 'Hi {{guest_name}},\n\nCheck-in: {{check_in_date}}\nProperty: {{property_title}}',
  },
  'review.request.guest': {
    subject: 'How was your stay at {{property_title}}?',
    heading: 'Tell us about your stay',
    preview: 'We hope you enjoyed {{property_title}}.',
    body: '<p>Hi {{guest_name}},</p><p>We hope you enjoyed <strong>{{property_title}}</strong>.</p><p>Share a quick review to help future guests choose with confidence.</p>',
    ctaLabel: 'Leave a review',
    ctaUrl: '{{review_url}}',
    text: 'Hi {{guest_name}},\n\nLeave a review: {{review_url}}',
  },
  'referral.commission.earned': {
    subject: 'You earned a StayLoop referral commission',
    heading: 'Referral commission earned',
    preview: 'You earned {{referral_amount}} from a {{referral_level}} referral booking.',
    body: '<p>Hi {{host_name}},</p><p>Great news — you earned <strong>{{referral_amount}}</strong> from a {{referral_level}} referral booking on {{property_title}}.</p>',
    ctaLabel: 'View earnings',
    ctaUrl: '{{site_url}}',
    text: 'Hi {{host_name}},\n\nYou earned {{referral_amount}}.',
  },
  'message.new.guest': {
    subject: 'New message from {{host_name}}',
    heading: 'New message from your host',
    preview: '{{message_preview}}',
    body: '<p>Hi {{guest_name}},</p><p><strong>{{host_name}}</strong> sent a new message about {{property_title}}:</p><blockquote style="margin:16px 0;padding:16px 20px;border-left:4px solid #f97316;background:#fff7ed;border-radius:12px;color:#334155;">{{message_preview}}</blockquote>',
    ctaLabel: 'Open conversation',
    ctaUrl: '{{conversation_url}}',
    text: 'Hi {{guest_name}},\n\nNew message: {{message_preview}}',
  },
  'message.new.host': {
    subject: 'New message from {{guest_name}}',
    heading: 'New guest message',
    preview: '{{message_preview}}',
    body: '<p>Hi {{host_name}},</p><p><strong>{{guest_name}}</strong> sent a new message about {{property_title}}:</p><blockquote style="margin:16px 0;padding:16px 20px;border-left:4px solid #f97316;background:#fff7ed;border-radius:12px;color:#334155;">{{message_preview}}</blockquote>',
    ctaLabel: 'Reply now',
    ctaUrl: '{{conversation_url}}',
    text: 'Hi {{host_name}},\n\nNew message: {{message_preview}}',
  },
  'pms.sync.failed': {
    subject: 'StayLoop PMS sync needs attention',
    heading: 'PMS sync failed',
    preview: 'We could not complete your latest {{pms_provider}} sync.',
    body: '<p>Hi {{host_name}},</p><p>We could not complete your latest <strong>{{pms_provider}}</strong> sync.</p><p style="padding:14px 16px;background:#fff1f2;border-radius:12px;color:#be123c;"><strong>Error:</strong> {{sync_error}}</p>',
    ctaLabel: 'Review PMS settings',
    ctaUrl: '{{pms_settings_url}}',
    text: 'Hi {{host_name}},\n\nPMS sync failed: {{sync_error}}',
  },
  'account.welcome.guest': {
    subject: 'Welcome to StayLoop',
    heading: 'Welcome to StayLoop',
    preview: 'Start exploring verified stays with transparent pricing and secure booking.',
    body: '<p>Hi {{guest_name}},</p><p>Welcome to StayLoop — verified stays, transparent pricing, and a booking experience built for memorable trips.</p>',
    ctaLabel: 'Explore stays',
    ctaUrl: '{{site_url}}',
    text: 'Hi {{guest_name}},\n\nWelcome to StayLoop.',
  },
  'account.welcome.host': {
    subject: 'Welcome to hosting on StayLoop',
    heading: 'Welcome, host',
    preview: 'List your property, connect your calendar, and start welcoming guests.',
    body: '<p>Hi {{host_name}},</p><p>Welcome to StayLoop hosting. List your property, connect your calendar, and start welcoming guests with professional tools and clear payouts.</p>',
    ctaLabel: 'Open host dashboard',
    ctaUrl: '{{site_url}}',
    text: 'Hi {{host_name}},\n\nWelcome to StayLoop hosting.',
  },
  'payout.sent.host': {
    subject: 'Your StayLoop payout is on the way',
    heading: 'Payout sent',
    preview: 'We sent {{payout_amount}} for {{property_title}}.',
    body: '<p>Hi {{host_name}},</p><p>We sent <strong>{{payout_amount}}</strong> for <strong>{{property_title}}</strong> on {{payout_date}}.</p>',
    ctaLabel: 'View payout details',
    ctaUrl: '{{site_url}}',
    text: 'Hi {{host_name}},\n\nPayout sent: {{payout_amount}}',
  },
};

async function main() {
  for (const [slug, name, description, category, recipient_role, sort_order, variables_schema] of triggers) {
    const rows = await rest(`email_triggers?on_conflict=slug`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ slug, name, description, category, recipient_role, sort_order, variables_schema, is_active: true }),
    });
    const trigger = rows[0];
    const templateDef = templates[slug];
    if (!templateDef) continue;

    await rest(`email_templates?on_conflict=trigger_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        trigger_id: trigger.id,
        subject: templateDef.subject,
        html_body: layout(templateDef.heading, templateDef.body, templateDef.preview, templateDef.ctaLabel, templateDef.ctaUrl),
        text_body: templateDef.text,
        preview_text: templateDef.preview,
        is_published: true,
        version: 1,
      }),
    });
    console.log(`Seeded ${slug}`);
  }

  const confirmed = (await rest('email_triggers?select=id&slug=eq.booking.confirmed.guest'))[0];
  if (confirmed) {
    const sequenceRows = await rest('email_sequences?on_conflict=slug', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        slug: 'booking.lifecycle',
        name: 'Booking lifecycle',
        description: 'Confirmation, pre-arrival (48h before check-in), day-of reminder, and review request (3h after checkout).',
        anchor_trigger_id: confirmed.id,
        is_active: true,
      }),
    });
    const sequence = sequenceRows[0];
    const stepDefs = [
      ['booking.confirmed.guest', 0, '0 seconds', 'trigger'],
      ['booking.reminder.checkin.guest', 1, '-2 days', 'check_in'],
      ['booking.reminder.checkin.guest', 2, '0 days', 'check_in'],
      ['review.request.guest', 3, '3 hours', 'check_out'],
    ];
    for (const [triggerSlug, stepOrder, delay, anchor] of stepDefs) {
      const trigger = (await rest(`email_triggers?select=id&slug=eq.${triggerSlug}`))[0];
      await rest('email_sequence_steps?on_conflict=sequence_id,step_order', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          sequence_id: sequence.id,
          trigger_id: trigger.id,
          step_order: stepOrder,
          delay_interval: delay,
          delay_anchor: anchor,
          is_active: true,
        }),
      });
    }
    console.log('Seeded booking.lifecycle sequence');
  }

  console.log('Email CMS seed complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
