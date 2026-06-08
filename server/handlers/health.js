import { getPool } from '../lib/db.js';
import { getStripe } from '../lib/stripe.js';

export function getHealth() {
  return {
    status: 'ok',
    service: 'stayloop-api',
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    supabaseAuthConfigured: Boolean(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
        (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
    ),
  };
}

export async function getDbHealth() {
  if (!process.env.DATABASE_URL) {
    throw Object.assign(new Error('DATABASE_URL is not configured'), { statusCode: 503 });
  }

  const pool = getPool();
  const result = await pool.query('SELECT current_database() AS db, now() AS server_time');

  return {
    ok: true,
    database: result.rows[0]?.db,
    serverTime: result.rows[0]?.server_time,
  };
}

export async function getStripeHealth() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error('STRIPE_SECRET_KEY is not configured'), { statusCode: 503 });
  }

  const stripe = getStripe();
  const balance = await stripe.balance.retrieve();

  return {
    ok: true,
    mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
    available: balance.available,
    pending: balance.pending,
  };
}
