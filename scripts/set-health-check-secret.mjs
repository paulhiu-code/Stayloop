#!/usr/bin/env node
import crypto from 'crypto';

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_ORG_ID;

if (!token || !projectId) {
  console.error('Missing VERCEL_TOKEN or VERCEL_PROJECT_ID');
  process.exit(1);
}

const healthSecret = process.env.HEALTH_CHECK_SECRET || crypto.randomBytes(32).toString('hex');

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

async function upsertEnv(key, value) {
  const existing = await vercelFetch(`/v9/projects/${projectId}/env`);
  for (const env of existing.envs?.filter((entry) => entry.key === key) || []) {
    await vercelFetch(`/v9/projects/${projectId}/env/${env.id}`, { method: 'DELETE' });
  }

  await vercelFetch(`/v10/projects/${projectId}/env`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      value,
      type: 'encrypted',
      target: ['production', 'preview'],
    }),
  });

  console.log(`Set ${key}`);
}

async function main() {
  await upsertEnv('HEALTH_CHECK_SECRET', healthSecret);

  const siteUrl = process.env.SITE_URL || 'https://stay-loop.co';
  await upsertEnv('SITE_URL', siteUrl);
  await upsertEnv(
    'ALLOWED_REDIRECT_ORIGINS',
    process.env.ALLOWED_REDIRECT_ORIGINS || `${siteUrl},https://www.stay-loop.co`
  );

  console.log('Done. Redeploy Vercel to apply env changes.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
