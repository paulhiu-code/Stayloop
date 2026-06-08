import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const isServerless = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isServerless ? { rejectUnauthorized: false } : undefined,
      max: isServerless ? 1 : 10,
    });
  }

  return pool;
}
