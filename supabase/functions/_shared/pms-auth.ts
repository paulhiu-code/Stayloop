/*
  Per-provider access-token acquisition + caching for PMS connections.

  - Hostaway: OAuth client_credentials (client_id = Account ID, client_secret =
    API Key). Tokens live up to ~24 months; we cache in oauth_access_token.
  - Guesty:   OAuth client_credentials. Tokens live 24h with a hard cap of 5
    issued per 24h, so caching until near expiry is mandatory.
  - OwnerRez: personal access token / OAuth access token already stored on the
    connection; used directly.
*/

// The concrete client type varies across edge functions; accept a structural
// client to avoid cross-module generic-version mismatches (matches the codebase
// convention of typing the supabase client loosely in sync functions).
// deno-lint-ignore no-explicit-any
type Supabase = any;

export const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';
export const GUESTY_API_BASE = 'https://open-api.guesty.com/v1';
export const GUESTY_OAUTH_URL = 'https://open-api.guesty.com/oauth2/token';

export interface PMSConnectionRow {
  id: string;
  user_id: string;
  pms_provider: 'ownerrez' | 'guesty' | 'hostaway';
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: string | null;
  api_credentials: Record<string, unknown> | null;
}

function credential(connection: PMSConnectionRow, keys: string[]): string | null {
  const creds = connection.api_credentials ?? {};
  for (const key of keys) {
    const value = creds[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function tokenStillValid(connection: PMSConnectionRow, skewMs = 5 * 60 * 1000): boolean {
  if (!connection.oauth_access_token) return false;
  if (!connection.oauth_expires_at) return true; // long-lived, no expiry recorded
  return new Date(connection.oauth_expires_at).getTime() - skewMs > Date.now();
}

async function requestClientCredentialsToken(
  url: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<{ accessToken: string; expiresInSec: number }> {
  const form = new URLSearchParams();
  form.set('grant_type', 'client_credentials');
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);
  form.set('scope', scope);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token request failed (${response.status}): ${body || response.statusText}`);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error('Token response missing access_token');
  }
  return { accessToken: payload.access_token, expiresInSec: payload.expires_in ?? 86400 };
}

async function persistToken(
  supabase: Supabase,
  connectionId: string,
  accessToken: string,
  expiresInSec: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
  await supabase
    .from('pms_connections')
    .update({ oauth_access_token: accessToken, oauth_expires_at: expiresAt })
    .eq('id', connectionId);
}

export async function getHostawayToken(
  supabase: Supabase,
  connection: PMSConnectionRow
): Promise<string> {
  if (tokenStillValid(connection)) return connection.oauth_access_token as string;

  const accountId = credential(connection, ['account_id', 'accountId', 'client_id']);
  const apiKey = credential(connection, ['api_key', 'apiKey', 'client_secret', 'secret']);
  if (!accountId || !apiKey) {
    throw new Error(
      'Hostaway connection is missing its Account ID / API Key. Reconnect the account.'
    );
  }

  const { accessToken, expiresInSec } = await requestClientCredentialsToken(
    `${HOSTAWAY_API_BASE}/accessTokens`,
    accountId,
    apiKey,
    'general'
  );
  await persistToken(supabase, connection.id, accessToken, expiresInSec);
  return accessToken;
}

export async function getGuestyToken(
  supabase: Supabase,
  connection: PMSConnectionRow
): Promise<string> {
  if (tokenStillValid(connection)) return connection.oauth_access_token as string;

  const clientId = credential(connection, ['client_id', 'clientId']);
  const clientSecret = credential(connection, ['client_secret', 'clientSecret', 'secret']);
  if (!clientId || !clientSecret) {
    // Fall back to a directly-stored token (legacy manual entry).
    if (connection.oauth_access_token) return connection.oauth_access_token;
    throw new Error(
      'Guesty connection is missing its Client ID / Client Secret. Reconnect the account.'
    );
  }

  const { accessToken, expiresInSec } = await requestClientCredentialsToken(
    GUESTY_OAUTH_URL,
    clientId,
    clientSecret,
    'open-api'
  );
  await persistToken(supabase, connection.id, accessToken, expiresInSec);
  return accessToken;
}

export async function getProviderToken(
  supabase: Supabase,
  connection: PMSConnectionRow
): Promise<string> {
  switch (connection.pms_provider) {
    case 'hostaway':
      return getHostawayToken(supabase, connection);
    case 'guesty':
      return getGuestyToken(supabase, connection);
    case 'ownerrez': {
      const token = String(
        connection.oauth_access_token || credential(connection, ['access_token']) || ''
      ).trim();
      if (!token) throw new Error('OwnerRez access token is missing');
      return token;
    }
    default:
      throw new Error(`Unsupported provider: ${connection.pms_provider}`);
  }
}
