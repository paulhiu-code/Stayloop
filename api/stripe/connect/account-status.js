import { getAccountStatus } from '../../../server/handlers/payments.js';
import { withAuth } from '../../_lib/withAuth.js';

export default withAuth(async (req, res, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountId = req.query.accountId;
  const result = await getAccountStatus(user, accountId);
  return res.status(200).json(result);
});
