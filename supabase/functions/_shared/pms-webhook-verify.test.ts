import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  timingSafeEqual,
  verifyBasicAuth,
  verifyGuestySvix,
  verifyStayLoopSignature,
} from './pms-webhook-verify.ts';

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(keyBytes: Uint8Array, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

Deno.test('timingSafeEqual', () => {
  assert(timingSafeEqual('abc', 'abc'));
  assert(!timingSafeEqual('abc', 'abd'));
  assert(!timingSafeEqual('abc', 'abcd'));
});

Deno.test('verifyBasicAuth accepts matching password', () => {
  const header = 'Basic ' + btoa('stayloop:s3cret-pass');
  assert(verifyBasicAuth(header, 's3cret-pass'));
  assert(!verifyBasicAuth(header, 'wrong'));
  assert(!verifyBasicAuth(null, 's3cret-pass'));
  // configured override wins over the secret
  assert(verifyBasicAuth('Basic ' + btoa('u:override'), 'secret', 'override'));
});

Deno.test('verifyStayLoopSignature round-trips our hex HMAC', async () => {
  const secret = 'stayloop-secret';
  const body = JSON.stringify({ event: 'reservation.new', id: 1 });
  const sig = toHex(await hmac(new TextEncoder().encode(secret), body));
  assert(await verifyStayLoopSignature(body, sig, secret));
  assert(await verifyStayLoopSignature(body, `sha256=${sig}`, secret));
  assert(!(await verifyStayLoopSignature(body, 'deadbeef', secret)));
});

Deno.test('verifyGuestySvix validates a correctly-signed payload', async () => {
  // Svix signing secrets are base64; use a valid base64 body.
  const svixSecret = 'whsec_' + btoa('0123456789abcdef0123456789abcdef');
  const body = JSON.stringify({ event: 'reservation.new', reservationId: 'abc' });
  const id = 'msg_2abc';
  const ts = '1720051200';

  // Sign exactly as Svix does: HMAC over `${id}.${ts}.${body}` with base64 secret.
  const rawSecret = svixSecret.slice('whsec_'.length);
  const binary = atob(rawSecret);
  const keyBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);
  const sigB64 = toBase64(await hmac(keyBytes, `${id}.${ts}.${body}`));

  const goodHeaders = { id, timestamp: ts, signature: `v1,${sigB64}` };
  assertEquals(await verifyGuestySvix(goodHeaders, body, svixSecret), true);

  // Multiple space-separated signatures; one valid.
  const multi = { id, timestamp: ts, signature: `v1,bogus v1,${sigB64}` };
  assertEquals(await verifyGuestySvix(multi, body, svixSecret), true);

  // Tampered body fails.
  assertEquals(await verifyGuestySvix(goodHeaders, body + 'x', svixSecret), false);

  // Missing headers fail closed.
  assertEquals(await verifyGuestySvix({ id: null, timestamp: ts, signature: `v1,${sigB64}` }, body, svixSecret), false);
});
