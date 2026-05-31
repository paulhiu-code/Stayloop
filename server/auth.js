import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export async function authenticateUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    if (!supabase) {
      return res
        .status(500)
        .json({ error: 'Server auth is not configured (set SUPABASE_URL and SUPABASE_ANON_KEY)' });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = { id: data.user.id, email: data.user.email };
    return next();
  } catch (err) {
    return next(err);
  }
}
