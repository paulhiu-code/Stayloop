import express from 'express';
import Stripe from 'stripe';
import pg from 'pg';
import stripeRouter, { handleStripeWebhook } from './routes/stripe.js';

const { Pool } = pg;

const app = express();
const port = Number(process.env.PORT || 3001);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.dbPool = pool;
    return handleStripeWebhook(req, res, next);
  }
);

app.use(express.json());
app.use((req, _res, next) => {
  req.dbPool = pool;
  next();
});
app.use(stripeRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`StayLoop API listening on port ${port}`);
});

export default app;
