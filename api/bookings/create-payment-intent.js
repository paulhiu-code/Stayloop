import { createPaymentIntent } from '../../server/handlers/payments.js';
import { withAuth } from '../_lib/withAuth.js';

export default withAuth(async (req, res, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await createPaymentIntent(user, req.body || {});
  return res.status(200).json(result);
});
