import express from 'express';
import stripeRouter from '../routes/stripe.js';
import { authenticateUser } from './auth.js';
import { handleStripeWebhook } from './webhook.js';

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

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'stayloop-api' });
});

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
