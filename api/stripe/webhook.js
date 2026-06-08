import { buffer } from 'micro';
import { handleStripeWebhookEvent } from '../../server/handlers/webhook.js';
import { sendError } from '../_lib/respond.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'];
    const result = await handleStripeWebhookEvent(rawBody, signature);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    return sendError(res, error);
  }
}
