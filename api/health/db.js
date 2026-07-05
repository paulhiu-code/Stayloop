import { getDbHealth } from '../../server/handlers/health.js';
import { assertInternalAccess } from '../../server/lib/internalAuth.js';
import { runHandler } from '../_lib/respond.js';

export default function handler(req, res) {
  return runHandler(res, async () => {
    assertInternalAccess(req);
    return getDbHealth();
  });
}
