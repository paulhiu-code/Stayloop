#!/usr/bin/env node
/**
 * Push server env vars to Vercel (Production + Preview).
 *
 * Usage:
 *   VERCEL_TOKEN=xxx node --env-file=.env.local scripts/configure-vercel-env.mjs
 *   VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=prj_xxx node --env-file=.env.local scripts/configure-vercel-env.mjs
 *
 * Get VERCEL_TOKEN: https://vercel.com/account/tokens
 * Get VERCEL_PROJECT_ID: Vercel project → Settings → General → Project ID
 */

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID;

if (!token) {
  console.error('Missing VERCEL_TOKEN. Create one at https://vercel.com/account/tokens');
  process.exit(1);
}

const SERVER_VARS = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SITE_URL',
  'ALLOWED_REDIRECT_ORIGINS',
];

const FRONTEND_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
];

const DEFAULTS = {
  SITE_URL: 'https://stay-loop.co',
  ALLOWED_REDIRECT_ORIGINS: 'https://stay-loop.co,https://www.stay-loop.co',
};

async function vercelFetch(path, options = {}) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set('teamId', teamId);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || body.message || `Vercel API ${response.status}`);
  }
  return body;
}

async function resolveProjectId() {
  if (projectId) return projectId;

  const projects = await vercelFetch('/v9/projects?limit=50');
  const match =
    projects.projects?.find((p) => p.name?.toLowerCase().includes('stay')) ||
    projects.projects?.find((p) =>
      p.alias?.some?.((a) => a.includes('stay-loop') || a.includes('stayloop'))
    );

  if (!match) {
    console.error('Could not auto-detect project. Set VERCEL_PROJECT_ID=prj_...');
    console.error('Projects found:', projects.projects?.map((p) => p.name).join(', ') || 'none');
    process.exit(1);
  }

  console.log(`Using project: ${match.name} (${match.id})`);
  return match.id;
}

async function upsertEnv(pid, key, value, targets) {
  const existing = await vercelFetch(`/v9/projects/${pid}/env`);
  const found = existing.envs?.filter((e) => e.key === key) || [];

  for (const env of found) {
    await vercelFetch(`/v9/projects/${pid}/env/${env.id}`, { method: 'DELETE' });
  }

  await vercelFetch(`/v10/projects/${pid}/env`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      value,
      type: key.startsWith('VITE_') ? 'plain' : 'encrypted',
      target: targets,
    }),
  });

  console.log(`  ✓ ${key}`);
}

async function main() {
  const pid = await resolveProjectId();
  const targets = ['production', 'preview'];

  console.log('\nSetting server env vars...');
  for (const key of SERVER_VARS) {
    const value = process.env[key] || DEFAULTS[key];
    if (!value) {
      console.warn(`  ⚠ Skipping ${key} — not in environment`);
      continue;
    }
    await upsertEnv(pid, key, value, targets);
  }

  console.log('\nSetting frontend env vars...');
  for (const key of FRONTEND_VARS) {
    const value = process.env[key];
    if (!value) {
      console.warn(`  ⚠ Skipping ${key} — not in environment`);
      continue;
    }
    await upsertEnv(pid, key, value, targets);
  }

  console.log('\nDone. Trigger a redeploy in Vercel (Deployments → Redeploy) to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
