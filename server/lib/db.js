import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const isServerless = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
    const sslCa = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isServerless
        ? {
            rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
            ...(sslCa ? { ca: sslCa } : {}),
          }
        : undefined,
      max: isServerless ? 1 : 10,
    });
  }

  return pool;
}
