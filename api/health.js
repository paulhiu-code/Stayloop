import { getHealth } from '../server/handlers/health.js';

export default function handler(_req, res) {
  return res.status(200).json(getHealth());
}
