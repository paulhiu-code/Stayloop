import express from 'express';
import Stripe from 'stripe';
import stripeRouter from '../routes/stripe.js';
import { authenticateUser } from './auth.js';
import { handleStripeWebhook } from './webhook.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

const app = express();
const PORT = process.env.PORT || 4000;
const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOrigin);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

// Stripe webhooks must be verified against the raw request body, so this route
// is registered before the JSON body parser and without auth (Stripe signs the
// request instead of sending a user session).
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'stayloop-api',
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    supabaseAuthConfigured: Boolean(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
        (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
    ),
  });
});

// Verifies the platform Stripe secret key can reach the StayLoop master account.
app.get('/health/stripe', async (_req, res) => {
  if (!stripe) {
    return res.status(503).json({ ok: false, error: 'STRIPE_SECRET_KEY is not configured' });
  }

  try {
    const balance = await stripe.balance.retrieve();
    return res.json({
      ok: true,
      mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
      available: balance.available,
      pending: balance.pending,
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Stripe connection failed',
    });
  }
});

// Everything below requires a verified Supabase session.
app.use(authenticateUser);
app.use(stripeRouter);

app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`StayLoop API listening on port ${PORT}`);
});

export default app;
