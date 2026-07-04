const LOCAL_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, '');
}

function parseAllowedOrigins(): string[] {
  const origins = new Set<string>();

  const siteUrl = Deno.env.get('SITE_URL') ?? Deno.env.get('STAYLOOP_SITE_URL') ?? '';
  if (siteUrl) origins.add(normalizeOrigin(siteUrl));

  const extra =
    Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ??
    Deno.env.get('STAYLOOP_ALLOWED_REDIRECT_ORIGINS') ??
    '';
  for (const part of extra.split(',')) {
    const trimmed = normalizeOrigin(part.trim());
    if (trimmed) origins.add(trimmed);
  }

  for (const devOrigin of LOCAL_DEV_ORIGINS) {
    origins.add(devOrigin);
  }

  return [...origins];
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const requestOrigin = req.headers.get('Origin');
  const fallback = allowed[0] ?? 'null';

  let allowOrigin = fallback;
  if (requestOrigin) {
    const normalized = normalizeOrigin(requestOrigin);
    if (allowed.some((entry) => entry === normalized)) {
      allowOrigin = requestOrigin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Client-Info, Apikey, x-stayloop-cron-secret, x-stayloop-signature',
    Vary: 'Origin',
  };
}
