import { handleStripeWebhookEvent } from './handlers/webhook.js';

export async function handleStripeWebhook(req, res) {
  try {
    const rawBody = req.body;
    const signature = req.headers['stripe-signature'];
    const result = await handleStripeWebhookEvent(rawBody, signature);
    return res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Webhook processing failed' });
  }
}
