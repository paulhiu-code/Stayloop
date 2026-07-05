/*
  Per-provider PMS webhook authentication. Extracted so it can be unit-tested.

  - OwnerRez / Hostaway: HTTP Basic Auth (password checked against webhook_secret
    or a configured webhook_password).
  - Guesty: Svix HMAC-SHA256 over `${id}.${ts}.${body}` with a base64 secret.
  - StayLoop: our own hex HMAC (`x-stayloop-signature`) for internal replays/tools.
*/

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256(keyBytes: Uint8Array, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export async function verifyStayLoopSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const digest = await hmacSha256(new TextEncoder().encode(secret), rawBody);
  const expected = toHex(digest);
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  return timingSafeEqual(provided, expected);
}

export function verifyBasicAuth(
  authorizationHeader: string | null,
  secret: string,
  configuredPasswordOverride?: string | null
): boolean {
  if (!authorizationHeader || !/^basic\s+/i.test(authorizationHeader)) return false;
  let decoded = '';
  try {
    decoded = atob(authorizationHeader.replace(/^basic\s+/i, '').trim());
  } catch {
    return false;
  }
  const password = decoded.slice(decoded.indexOf(':') + 1);
  const configuredPassword =
    (typeof configuredPasswordOverride === 'string' && configuredPasswordOverride) || secret;
  return Boolean(configuredPassword) && timingSafeEqual(password, configuredPassword);
}

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export async function verifyGuestySvix(
  headers: SvixHeaders,
  rawBody: string,
  secret: string
): Promise<boolean> {
  if (!headers.id || !headers.timestamp || !headers.signature || !secret) return false;

  const rawSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(rawSecret);
  } catch {
    keyBytes = new TextEncoder().encode(rawSecret);
  }

  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = toBase64(await hmacSha256(keyBytes, signedContent));

  for (const part of headers.signature.split(' ')) {
    const [, value] = part.split(',');
    if (value && timingSafeEqual(value, expected)) return true;
  }
  return false;
}

export function svixHeadersFromRequest(req: Request): SvixHeaders {
  return {
    id: req.headers.get('svix-id') ?? req.headers.get('webhook-id'),
    timestamp: req.headers.get('svix-timestamp') ?? req.headers.get('webhook-timestamp'),
    signature: req.headers.get('svix-signature') ?? req.headers.get('webhook-signature'),
  };
}

export async function verifyProviderWebhook(
  req: Request,
  rawBody: string,
  provider: string,
  connection: Record<string, unknown>,
  secret: string
): Promise<boolean> {
  if (await verifyStayLoopSignature(rawBody, req.headers.get('x-stayloop-signature'), secret)) {
    return true;
  }

  const creds = (connection.api_credentials as Record<string, unknown> | null) ?? {};
  const webhookPassword = typeof creds.webhook_password === 'string' ? creds.webhook_password : null;

  switch (provider) {
    case 'guesty':
      return verifyGuestySvix(svixHeadersFromRequest(req), rawBody, secret);
    case 'ownerrez':
    case 'hostaway':
      return verifyBasicAuth(req.headers.get('authorization'), secret, webhookPassword);
    default:
      return false;
  }
}
