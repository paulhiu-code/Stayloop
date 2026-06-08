import { getStripeHealth } from '../../server/handlers/health.js';
import { runHandler } from '../_lib/respond.js';

export default function handler(_req, res) {
  return runHandler(res, getStripeHealth);
}
