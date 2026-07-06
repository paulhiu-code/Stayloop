import { sendWelcomeEmail } from '../../server/account-emails.js';
import { getPool } from '../../server/lib/db.js';
import { withAuth } from '../_lib/withAuth.js';

export default withAuth(async (req, res, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email, full_name, user_type
     FROM profiles
     WHERE id = $1
     LIMIT 1`,
    [user.id]
  );

  const profile = rows[0];
  if (!profile?.email) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const result = await sendWelcomeEmail(pool, {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    userType: profile.user_type,
  });

  return res.json({ ok: true, result });
});
