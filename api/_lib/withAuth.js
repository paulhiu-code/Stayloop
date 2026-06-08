import { getAuthUser } from '../../server/lib/auth.js';
import { sendError } from './respond.js';

export function withAuth(handler) {
  return async (req, res) => {
    const auth = await getAuthUser(req);
    if (auth.error) {
      return res.status(auth.error.status).json({ error: auth.error.message });
    }

    try {
      return await handler(req, res, auth.user);
    } catch (error) {
      console.error('API error:', error);
      return sendError(res, error);
    }
  };
}
