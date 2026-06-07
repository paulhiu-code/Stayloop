/*
  # Email lifecycle cadence + booking confirmed_at

  - Adds bookings.confirmed_at for lifecycle anchor timing
  - Aligns booking.lifecycle sequence steps with Airbnb-style cadence:
    48h before check-in, day-of check-in, 3h after checkout
*/

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

UPDATE bookings
SET confirmed_at = updated_at
WHERE confirmed_at IS NULL
  AND status IN ('confirmed', 'checked_in', 'checked_out');

-- Replace stale lifecycle reminder/review steps (keep step 0 confirmation anchor).
DELETE FROM email_sequence_steps ess
USING email_sequences es, email_triggers et
WHERE ess.sequence_id = es.id
  AND ess.trigger_id = et.id
  AND es.slug = 'booking.lifecycle'
  AND ess.step_order > 0;

INSERT INTO email_sequence_steps (sequence_id, trigger_id, step_order, delay_interval, delay_anchor, is_active)
SELECT s.id, t.id, steps.step_order, steps.delay_interval, steps.delay_anchor, true
FROM email_sequences s
CROSS JOIN (
  VALUES
    ('booking.reminder.checkin.guest', 1, interval '-2 days', 'check_in'),
    ('booking.reminder.checkin.guest', 2, interval '0 days', 'check_in'),
    ('review.request.guest', 3, interval '3 hours', 'check_out')
) AS steps(trigger_slug, step_order, delay_interval, delay_anchor)
JOIN email_triggers t ON t.slug = steps.trigger_slug
WHERE s.slug = 'booking.lifecycle'
ON CONFLICT (sequence_id, step_order) DO UPDATE
SET
  trigger_id = EXCLUDED.trigger_id,
  delay_interval = EXCLUDED.delay_interval,
  delay_anchor = EXCLUDED.delay_anchor,
  is_active = EXCLUDED.is_active;

UPDATE email_sequences
SET description = 'Confirmation, pre-arrival (48h before check-in), day-of reminder, and review request (3h after checkout).'
WHERE slug = 'booking.lifecycle';
