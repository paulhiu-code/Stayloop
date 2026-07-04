import { processBookingLifecycleEmails } from '../../server/booking-emails.js';
import { getPool } from '../../server/lib/db.js';

export default async function handler(req, res) {
  // Vercel Cron invokes GET by default; the Express route uses POST — accept both.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET || process.env.EMAIL_CRON_SECRET || '';
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();

  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const lifecycle = await processBookingLifecycleEmails(getPool());
    return res.json({
      ok: true,
      processed: lifecycle.length,
      lifecycle,
    });
  } catch (error) {
    console.error('Email cron error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Email cron failed',
    });
  }
}
