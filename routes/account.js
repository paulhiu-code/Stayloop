import express from 'express';
import pg from 'pg';
import { sendWelcomeEmail } from '../server/account-emails.js';
import { processBookingLifecycleEmails } from '../server/booking-emails.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
});

const router = express.Router();

function requireUser(req, res, next) {
  const userId = req.user?.id;

  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ error: 'Authenticated user is required' });
  }

  req.stayloopUserId = userId;
  return next();
}

router.post('/api/account/send-welcome', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, user_type
       FROM profiles
       WHERE id = $1
       LIMIT 1`,
      [req.stayloopUserId]
    );

    const profile = rows[0];
    if (!profile?.email) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const result = await sendWelcomeEmail(pool, {
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      userType: profile.user_type,
    });

    return res.json({ ok: true, result });
  } catch (error) {
    return next(error);
  }
});

export function mountCronRoutes(app) {
  app.post('/api/cron/process-emails', async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || process.env.EMAIL_CRON_SECRET || '';
    const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();

    if (!cronSecret || provided !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const lifecycle = await processBookingLifecycleEmails(pool);
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
  });
}

export default router;
