const SITE_URL = (process.env.SITE_URL || 'https://stay-loop.co').replace(/\/$/, '');

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function confirmationCode(bookingId) {
  return `SL-${String(bookingId).replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

async function wasTriggerSent(pool, bookingId, triggerSlug) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM email_delivery_log
     WHERE trigger_slug = $1
       AND (
         metadata->>'booking_id' = $2
         OR metadata->'variables'->>'booking_id' = $2
       )
       AND status = 'sent'
     LIMIT 1`,
    [triggerSlug, bookingId]
  );

  return rows.length > 0;
}

async function sendTriggerEmail({ trigger, to, variables }) {
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
        booking_id: variables.booking_id,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `send-email failed with ${response.status}`);
  }

  return payload;
}

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
       b.stripe_payment_intent_id,
       b.guest_user_id,
       b.host_user_id,
       p.title AS property_title,
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

function buildEmailVariables(booking) {
  const checkIn = booking.check_in_date || booking.check_in;
  const checkOut = booking.check_out_date || booking.check_out;
  const code = confirmationCode(booking.id);

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
    confirmation_code: code,
    manage_booking_url: `${SITE_URL}/dashboard`,
    site_url: SITE_URL,
  };
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
           updated_at = now()
       WHERE id = $1
         AND status = 'pending'`,
      [bookingId]
    );
    booking.status = 'confirmed';
  }

  const variables = buildEmailVariables(booking);
  const sends = [];

  const triggers = [
    { slug: 'booking.confirmed.guest', to: booking.guest_email },
    { slug: 'booking.confirmed.host', to: booking.host_email },
    { slug: 'booking.payment.receipt', to: booking.guest_email },
  ];

  for (const trigger of triggers) {
    if (!trigger.to) continue;

    const alreadySent = await wasTriggerSent(pool, bookingId, trigger.slug);
    if (alreadySent) {
      sends.push({ trigger: trigger.slug, to: trigger.to, skipped: true });
      continue;
    }

    const result = await sendTriggerEmail({
      trigger: trigger.slug,
      to: trigger.to,
      variables,
    });

    sends.push({
      trigger: trigger.slug,
      to: trigger.to,
      messageId: result.messageId,
      skipped: false,
    });
  }

  return {
    bookingId,
    status: booking.status,
    emails: sends,
  };
}

export async function confirmBookingByPaymentIntent(pool, paymentIntentId) {
  const { rows } = await pool.query(
    `SELECT id
     FROM bookings
     WHERE stripe_payment_intent_id = $1
     LIMIT 1`,
    [paymentIntentId]
  );

  if (!rows[0]) {
    return null;
  }

  return confirmBookingAndSendEmails(pool, {
    bookingId: rows[0].id,
    paymentIntentId,
  });
}
