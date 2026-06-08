import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export async function getAuthUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return { error: { status: 401, message: 'Missing bearer token' } };
  }

  if (!supabase) {
    return {
      error: {
        status: 500,
        message: 'Server auth is not configured (set SUPABASE_URL and SUPABASE_ANON_KEY)',
      },
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { error: { status: 401, message: 'Invalid or expired session' } };
  }

  return { user: { id: data.user.id, email: data.user.email } };
}

// Express middleware adapter
export async function authenticateUser(req, res, next) {
  try {
    const result = await getAuthUser(req);
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    req.user = result.user;
    return next();
  } catch (err) {
    return next(err);
  }
}
