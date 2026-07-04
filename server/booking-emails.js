import {
  SITE_URL,
  addInterval,
  anchorDateTime,
  bookingDedupeKey,
  confirmationCode,
  dispatchTrigger,
  formatCurrency,
  formatDate,
} from './email-dispatch.js';

async function loadBookingContext(pool, bookingId) {
  const { rows } = await pool.query(
    `SELECT
       b.id,
       b.status,
       b.check_in,
       b.check_out,
       b.check_in_date,
       b.check_out_date,
       b.num_guests,
       b.total_amount,
       b.host_payout,
       b.host_service_fee,
       b.stripe_payment_intent_id,
       b.guest_user_id,
       b.host_user_id,
       b.updated_at,
       b.confirmed_at,
       p.title AS property_title,
       p.house_rules,
       guest.email AS guest_email,
       guest.full_name AS guest_name,
       host.email AS host_email,
       host.full_name AS host_name
     FROM bookings b
     JOIN properties p ON p.id = b.property_id
     JOIN profiles guest ON guest.id = b.guest_user_id
     JOIN profiles host ON host.id = b.host_user_id
     WHERE b.id = $1
     LIMIT 1`,
    [bookingId]
  );

  return rows[0] || null;
}

function buildBookingVariables(booking, extras = {}) {
  const checkIn = booking.check_in_date || booking.check_in;
  const checkOut = booking.check_out_date || booking.check_out;

  return {
    booking_id: booking.id,
    guest_name: booking.guest_name || 'Guest',
    host_name: booking.host_name || 'Host',
    property_title: booking.property_title || 'Your stay',
    check_in_date: formatDate(checkIn),
    check_out_date: formatDate(checkOut),
    num_guests: String(booking.num_guests || 1),
    total_amount: formatCurrency(Number(booking.total_amount || 0)),
    host_payout: formatCurrency(Number(booking.host_payout || 0)),
    payment_date: formatDate(new Date()),
    confirmation_code: confirmationCode(booking.id),
    manage_booking_url: `${SITE_URL}/dashboard`,
    message_host_url: `${SITE_URL}/dashboard`,
    conversation_url: `${SITE_URL}/dashboard`,
    review_url: `${SITE_URL}/dashboard?review=${booking.id}`,
    check_in_instructions:
      booking.house_rules?.slice(0, 500) ||
      'Your host will share final check-in details before arrival.',
    site_url: SITE_URL,
    ...extras,
  };
}

async function sendReferralCommissionEmails(pool, bookingId, variables) {
  const { rows } = await pool.query(
    `SELECT
       re.id,
       re.referral_level,
       re.commission_amount,
       re.payout_amount,
       earner.email AS earner_email,
       earner.full_name AS earner_name
     FROM referral_earnings re
     JOIN profiles earner ON earner.id = re.earner_id
     WHERE re.booking_id = $1`,
    [bookingId]
  );

  const sends = [];
  for (const earning of rows) {
    const result = await dispatchTrigger(pool, {
      triggerSlug: 'referral.commission.earned',
      to: earning.earner_email,
      dedupeKey: bookingDedupeKey(bookingId, 'referral.commission.earned', `L${earning.referral_level}`),
      variables: {
        ...variables,
        host_name: earning.earner_name || 'Host',
        referral_amount: formatCurrency(Number(earning.payout_amount ?? earning.commission_amount ?? 0)),
        referral_level: `Level ${earning.referral_level}`,
      },
    });
    sends.push({ trigger: 'referral.commission.earned', to: earning.earner_email, ...result });
  }

  return sends;
}

export async function confirmBookingAndSendEmails(pool, { bookingId, paymentIntentId, userId }) {
  const booking = await loadBookingContext(pool, bookingId);

  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (userId && booking.guest_user_id !== userId) {
    const error = new Error('Booking does not belong to authenticated guest');
    error.statusCode = 403;
    throw error;
  }

  if (paymentIntentId && booking.stripe_payment_intent_id !== paymentIntentId) {
    const error = new Error('Payment intent does not match booking');
    error.statusCode = 400;
    throw error;
  }

  if (booking.status === 'cancelled') {
    const error = new Error('Booking is cancelled');
    error.statusCode = 409;
    throw error;
  }

  if (booking.status === 'pending') {
    await pool.query(
      `UPDATE bookings
       SET status = 'confirmed',
           confirmed_at = COALESCE(confirmed_at, now()),
           updated_at = now()
       WHERE id = $1
         AND status = 'pending'`,
      [bookingId]
    );
    booking.status = 'confirmed';
    booking.confirmed_at = new Date();
  }

  const variables = buildBookingVariables(booking);
  const sends = [];

  for (const trigger of [
    { slug: 'booking.confirmed.guest', to: booking.guest_email },
    { slug: 'booking.confirmed.host', to: booking.host_email },
    { slug: 'booking.payment.receipt', to: booking.guest_email },
  ]) {
    const result = await dispatchTrigger(pool, {
      triggerSlug: trigger.slug,
      to: trigger.to,
      dedupeKey: bookingDedupeKey(bookingId, trigger.slug),
      variables,
    });
    sends.push({ trigger: trigger.slug, to: trigger.to, ...result });
  }

  const referralSends = await sendReferralCommissionEmails(pool, bookingId, variables);
  sends.push(...referralSends);

  return {
    bookingId,
    status: booking.status,
    emails: sends,
  };
}

export async function sendBookingCancelledEmails(pool, bookingId) {
  const booking = await loadBookingContext(pool, bookingId);
  if (!booking) return null;

  const variables = buildBookingVariables(booking, {
    refund_amount: formatCurrency(Number(booking.total_amount || 0)),
  });

  const sends = [];
  for (const trigger of [
    { slug: 'booking.cancelled.guest', to: booking.guest_email },
    { slug: 'booking.cancelled.host', to: booking.host_email },
  ]) {
    const result = await dispatchTrigger(pool, {
      triggerSlug: trigger.slug,
      to: trigger.to,
      dedupeKey: bookingDedupeKey(bookingId, trigger.slug),
      variables,
    });
    sends.push({ trigger: trigger.slug, to: trigger.to, ...result });
  }

  return { bookingId, emails: sends };
}

export async function sendHostPayoutEmail(pool, bookingId) {
  const booking = await loadBookingContext(pool, bookingId);
  if (!booking) return null;

  const variables = buildBookingVariables(booking, {
    payout_amount: formatCurrency(Number(booking.host_payout || 0)),
    payout_date: formatDate(new Date()),
  });

  const result = await dispatchTrigger(pool, {
    triggerSlug: 'payout.sent.host',
    to: booking.host_email,
    dedupeKey: bookingDedupeKey(bookingId, 'payout.sent.host'),
    variables,
  });

  return { bookingId, emails: [result] };
}

export async function confirmBookingByPaymentIntent(pool, paymentIntentId) {
  const { rows } = await pool.query(
    `SELECT id
     FROM bookings
     WHERE stripe_payment_intent_id = $1
     LIMIT 1`,
    [paymentIntentId]
  );

  if (!rows[0]) return null;

  return confirmBookingAndSendEmails(pool, {
    bookingId: rows[0].id,
    paymentIntentId,
  });
}

export async function processBookingLifecycleEmails(pool) {
  const { rows: steps } = await pool.query(
    `SELECT
       ess.id,
       ess.step_order,
       ess.delay_interval::text AS delay_interval,
       ess.delay_anchor,
       et.slug AS trigger_slug,
       et.recipient_role
     FROM email_sequence_steps ess
     JOIN email_sequences es ON es.id = ess.sequence_id
     JOIN email_triggers et ON et.id = ess.trigger_id
     WHERE es.slug = 'booking.lifecycle'
       AND es.is_active = true
       AND ess.is_active = true
       AND et.is_active = true
       AND et.slug NOT IN ('booking.confirmed.guest', 'booking.confirmed.host', 'booking.payment.receipt')
     ORDER BY ess.step_order ASC`
  );

  const { rows: bookings } = await pool.query(
    `SELECT
       b.id,
       b.status,
       b.check_in,
       b.check_out,
       b.check_in_date,
       b.check_out_date,
       b.num_guests,
       b.total_amount,
       b.host_payout,
       b.updated_at,
       b.confirmed_at,
       p.title AS property_title,
       p.house_rules,
       guest.email AS guest_email,
       guest.full_name AS guest_name
     FROM bookings b
     JOIN properties p ON p.id = b.property_id
     JOIN profiles guest ON guest.id = b.guest_user_id
     WHERE b.status IN ('confirmed', 'checked_in', 'checked_out')
       AND COALESCE(b.check_out_date, b.check_out) >= CURRENT_DATE - INTERVAL '3 days'
       AND COALESCE(b.check_in_date, b.check_in) <= CURRENT_DATE + INTERVAL '14 days'`
  );

  const now = Date.now();
  const results = [];

  for (const booking of bookings) {
    const variables = buildBookingVariables(booking);

    for (const step of steps) {
      const anchor = anchorDateTime(booking, step.delay_anchor);
      const dueAt = addInterval(anchor, step.delay_interval);
      if (!dueAt) continue;

      const graceMs = 36 * 60 * 60 * 1000;
      if (now < dueAt.getTime() || now > dueAt.getTime() + graceMs) continue;

      const dedupeKey = bookingDedupeKey(booking.id, step.trigger_slug, `step-${step.step_order}`);
      const result = await dispatchTrigger(pool, {
        triggerSlug: step.trigger_slug,
        to: booking.guest_email,
        dedupeKey,
        variables,
      });

      results.push({
        bookingId: booking.id,
        trigger: step.trigger_slug,
        dueAt: dueAt.toISOString(),
        ...result,
      });
    }
  }

  return results;
}
