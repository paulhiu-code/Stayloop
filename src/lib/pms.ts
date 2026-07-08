import { supabase } from './supabase';

export function formatSyncError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    for (const key of ['message', 'error', 'details', 'hint']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
    try {
      return JSON.stringify(error).slice(0, 600);
    } catch {
      return String(error);
    }
  }
  return 'Unknown sync error. Hard-refresh the page (Ctrl+Shift+R), then try again.';
}



export type PMSProvider = 'ownerrez' | 'guesty' | 'hostaway';

export type PMSSyncDirection = 'inbound' | 'outbound' | 'two_way';

export interface PMSConnection {
  id: string;
  user_id: string;
  pms_provider: PMSProvider;
  account_name: string | null;
  is_active: boolean;
  sync_direction: PMSSyncDirection;
  oauth_expires_at: string | null;
  sync_settings: Record<string, unknown>;
  last_sync_at: string | null;
  sync_status: 'pending' | 'syncing' | 'completed' | 'failed';
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

const PMS_CONNECTION_COLUMNS =
  'id, user_id, pms_provider, account_name, is_active, sync_direction, oauth_expires_at, sync_settings, last_sync_at, sync_status, sync_error, created_at, updated_at';

export interface PMSPropertyMapping {
  id: string;
  pms_connection_id: string;
  stayloop_property_id: string;
  pms_property_id: string;
  pms_property_data: Record<string, unknown> | null;
  sync_direction: 'to_pms' | 'from_pms' | 'bidirectional';
  auto_sync_enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface PMSSyncLog {
  id: string;
  pms_connection_id: string;
  pms_property_mapping_id: string | null;
  sync_type: 'property' | 'booking' | 'availability' | 'pricing' | 'full' | 'webhook';
  sync_direction: 'to_pms' | 'from_pms';
  status: 'started' | 'completed' | 'failed' | 'partial';
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  error_details: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}



async function invokePMSEdgeFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) {
    throw new Error('Please sign in again, then retry sync.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('StayLoop is missing Supabase configuration.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const payloadMessage =
      payload && typeof payload === 'object'
        ? (typeof payload.error === 'string' && payload.error) ||
          (typeof payload.message === 'string' && payload.message) ||
          (typeof payload.msg === 'string' && payload.msg) ||
          null
        : null;
    const detail =
      payloadMessage ||
      (raw?.trim() ? raw.slice(0, 500) : '') ||
      `Sync failed (HTTP ${response.status}). Check Supabase Edge Function logs for pms-ownerrez-sync.`;
    throw new Error(detail);
  }

  if (payload?.success === false && typeof payload.error === 'string') {
    throw new Error(payload.error);
  }

  return payload;
}

export interface PMSCredentialField {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  optional?: boolean;
}

export interface PMSProviderInfo {
  id: PMSProvider;
  name: string;
  description: string;
  features: string[];
  setupUrl: string;
  /** Fields collected on the connect form for this provider. */
  fields: PMSCredentialField[];
  /** Whether StayLoop can push bookings into this PMS via the public API today. */
  outboundKind: 'reservation' | 'calendar_block';
}

export const pmsProviders: PMSProviderInfo[] = [
  {
    id: 'ownerrez',
    name: 'OwnerRez',
    description: 'Connect your OwnerRez account to sync properties, bookings, and availability',
    features: ['Property Sync', 'Booking Sync', 'Calendar Sync', 'Real-time Webhooks'],
    setupUrl: 'https://www.ownerrez.com/support/articles/api-overview',
    fields: [
      { key: 'ownerrez_email', label: 'OwnerRez login email', placeholder: 'you@example.com' },
      { key: 'access_token', label: 'Access token (pt_…)', placeholder: 'Paste your OwnerRez token', secret: true },
    ],
    outboundKind: 'calendar_block',
  },
  {
    id: 'guesty',
    name: 'Guesty',
    description: 'Integrate with Guesty for seamless property and reservation management',
    features: ['Listing Sync', 'Reservation Sync', 'Calendar Management', 'Multi-channel Support'],
    setupUrl: 'https://open-api-docs.guesty.com/',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Guesty OAuth client ID' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Guesty OAuth client secret', secret: true },
    ],
    outboundKind: 'reservation',
  },
  {
    id: 'hostaway',
    name: 'Hostaway',
    description: 'Connect Hostaway to sync listings, reservations, and calendars in real time',
    features: ['Listing Sync', 'Reservation Push', 'Calendar Sync', 'Partner Channel (2020)'],
    setupUrl: 'https://api.hostaway.com/documentation',
    fields: [
      { key: 'account_id', label: 'Account ID', placeholder: 'Hostaway Account ID' },
      { key: 'api_key', label: 'API Key', placeholder: 'Hostaway API Key', secret: true },
    ],
    outboundKind: 'reservation',
  },
];

function functionForProvider(provider: PMSProvider): string {
  switch (provider) {
    case 'ownerrez':
      return 'pms-ownerrez-sync';
    case 'hostaway':
      return 'pms-hostaway-sync';
    case 'guesty':
    default:
      return 'pms-guesty-sync';
  }
}

export async function createPMSConnection(
  provider: PMSProvider,
  accessToken: string,
  refreshToken?: string,
  accountName?: string,
  apiCredentials?: Record<string, unknown>
): Promise<PMSConnection> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pms_connections')
    .insert({
      user_id: session.session.user.id,
      pms_provider: provider,
      account_name: accountName,
      oauth_access_token: accessToken,
      oauth_refresh_token: refreshToken,
      api_credentials: apiCredentials ?? null,
      is_active: true,
    })
    .select(PMS_CONNECTION_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

// Provider-aware connect: OwnerRez stores its token directly; Guesty/Hostaway
// store the client credentials so the edge functions can mint short-lived tokens.
export async function createProviderConnection(
  provider: PMSProvider,
  accountName: string,
  values: Record<string, string>,
  syncDirection: PMSSyncDirection = 'two_way'
): Promise<PMSConnection> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const apiCredentials: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value?.trim()) apiCredentials[key] = value.trim();
  }

  const oauthAccessToken =
    provider === 'ownerrez' ? values.access_token?.trim() || null : null;

  const { data, error } = await supabase
    .from('pms_connections')
    .insert({
      user_id: session.session.user.id,
      pms_provider: provider,
      account_name: accountName || null,
      oauth_access_token: oauthAccessToken,
      api_credentials: apiCredentials,
      sync_direction: syncDirection,
      is_active: true,
    })
    .select(PMS_CONNECTION_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function setPMSSyncDirection(
  connectionId: string,
  direction: PMSSyncDirection
): Promise<void> {
  const { error } = await supabase
    .from('pms_connections')
    .update({ sync_direction: direction })
    .eq('id', connectionId);
  if (error) throw error;
}

export async function getPMSConnections(): Promise<PMSConnection[]> {
  const { data, error } = await supabase
    .from('pms_connections')
    .select(PMS_CONNECTION_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function testOwnerRezConnection(connectionId: string): Promise<string> {
  const payload = await invokePMSEdgeFunction('pms-ownerrez-sync', {
    action: 'test_ownerrez',
    pmsConnectionId: connectionId,
  });
  const result = payload?.result as { propertyCount?: number; email?: string } | undefined;
  const count = result?.propertyCount ?? 0;
  const email = result?.email ?? 'unknown';
  return `OwnerRez connection OK. Found ${count} active properties for ${email}.`;
}

export async function syncPMSProperties(connectionId: string): Promise<unknown> {
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('pms_provider')
    .eq('id', connectionId)
    .single();

  if (!connection) throw new Error('Connection not found');

  const functionName = functionForProvider(connection.pms_provider as PMSProvider);

  const payload = await invokePMSEdgeFunction(functionName, {
    action: 'sync_properties',
    pmsConnectionId: connectionId,
  });

  const result = payload?.result as { succeeded?: number; processed?: number } | undefined;
  if (result?.processed && result.succeeded === 0) {
    throw new Error('OwnerRez properties were found but none could be saved. Check your host profile and try again.');
  }

  return payload;
}

export async function syncPMSBookings(connectionId: string, propertyId?: string): Promise<unknown> {
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('pms_provider')
    .eq('id', connectionId)
    .single();

  if (!connection) throw new Error('Connection not found');

  const functionName = functionForProvider(connection.pms_provider as PMSProvider);

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: {
      action: 'sync_bookings',
      pmsConnectionId: connectionId,
      propertyId,
    },
  });

  if (error) throw error;
  return data;
}

export async function syncPMSAvailability(connectionId: string, propertyId: string): Promise<unknown> {
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('pms_provider')
    .eq('id', connectionId)
    .single();

  if (!connection) throw new Error('Connection not found');

  const functionName = functionForProvider(connection.pms_provider as PMSProvider);

  return invokePMSEdgeFunction(functionName, {
    action: 'sync_availability',
    pmsConnectionId: connectionId,
    propertyId,
  });
}

export async function getPropertyMappings(connectionId: string): Promise<PMSPropertyMapping[]> {
  const { data, error } = await supabase
    .from('pms_property_mappings')
    .select('*')
    .eq('pms_connection_id', connectionId);

  if (error) throw error;
  return data || [];
}

export async function getSyncLogs(connectionId: string, limit = 50): Promise<PMSSyncLog[]> {
  const { data, error } = await supabase
    .from('pms_sync_logs')
    .select('*')
    .eq('pms_connection_id', connectionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}


export function getPMSWebhookUrl(connectionId: string, provider: PMSProvider): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '');
  if (!supabaseUrl) return '';
  return `${supabaseUrl}/functions/v1/pms-webhook-receiver?provider=${provider}&connection_id=${connectionId}`;
}

export function isPMSAutoSyncEnabled(connection: PMSConnection): boolean {
  const settings = connection.sync_settings as Record<string, unknown> | null;
  if (!settings) return true;
  return settings.auto_sync !== false;
}

export async function setPMSAutoSync(connectionId: string, enabled: boolean): Promise<void> {
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('sync_settings')
    .eq('id', connectionId)
    .single();

  if (!connection) throw new Error('Connection not found');

  const settings = {
    ...((connection.sync_settings as Record<string, unknown>) || {}),
    auto_sync: enabled,
  };

  const { error } = await supabase
    .from('pms_connections')
    .update({ sync_settings: settings })
    .eq('id', connectionId);

  if (error) throw error;
}

export type CalendarSyncPropertyResult = {
  pmsPropertyId: string;
  blockedNights?: number;
  availableNights?: number;
  pricingNights?: number;
  error?: string;
};

export async function syncAllPMSAvailability(connectionId: string): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  properties: CalendarSyncPropertyResult[];
}> {
  const mappings = await getPropertyMappings(connectionId);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const properties: CalendarSyncPropertyResult[] = [];

  for (const mapping of mappings) {
    if (mapping.auto_sync_enabled === false) continue;
    processed += 1;
    try {
      const response = (await syncPMSAvailability(connectionId, mapping.pms_property_id)) as {
        success?: boolean;
        result?: {
          blockedNights?: number;
          availableNights?: number;
          pricingNights?: number;
        };
        error?: string;
      };

      if (response?.success === false) {
        throw new Error(response.error || 'Calendar sync failed');
      }

      const result = response?.result;
      properties.push({
        pmsPropertyId: mapping.pms_property_id,
        blockedNights: result?.blockedNights,
        availableNights: result?.availableNights,
        pricingNights: result?.pricingNights,
      });
      succeeded += 1;
    } catch (error) {
      console.error(`Availability sync failed for ${mapping.pms_property_id}:`, error);
      properties.push({
        pmsPropertyId: mapping.pms_property_id,
        error: error instanceof Error ? error.message : String(error),
      });
      failed += 1;
    }
  }

  return { processed, succeeded, failed, properties };
}

export async function syncAllPMS(connectionId: string): Promise<unknown> {
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('pms_provider')
    .eq('id', connectionId)
    .single();

  if (!connection) throw new Error('Connection not found');

  if (connection.pms_provider === 'ownerrez' || connection.pms_provider === 'hostaway') {
    return invokePMSEdgeFunction(functionForProvider(connection.pms_provider as PMSProvider), {
      action: 'sync_all',
      pmsConnectionId: connectionId,
    });
  }

  return syncAllPMSAvailability(connectionId);
}

export async function deletePMSConnection(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('pms_connections')
    .delete()
    .eq('id', connectionId);

  if (error) throw error;
}

export async function togglePMSConnection(connectionId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('pms_connections')
    .update({ is_active: isActive })
    .eq('id', connectionId);

  if (error) throw error;
}

// --- Universal iCal channel --------------------------------------------------

export interface HostProperty {
  id: string;
  title: string;
  ical_export_token: string | null;
}

export interface ICalFeed {
  id: string;
  property_id: string;
  label: string | null;
  feed_url: string;
  is_active: boolean;
  last_imported_at: string | null;
  last_import_status: 'success' | 'failed' | null;
  last_import_error: string | null;
  last_event_count: number;
  created_at: string;
}

function supabaseFunctionsBase(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '');
  if (!supabaseUrl) throw new Error('StayLoop is missing Supabase configuration.');
  return supabaseUrl;
}

export async function getHostProperties(): Promise<HostProperty[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('properties')
    .select('id, title, ical_export_token')
    .eq('host_id', session.session.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as HostProperty[]) || [];
}

export function getICalExportUrl(property: HostProperty): string {
  if (!property.ical_export_token) return '';
  return `${supabaseFunctionsBase()}/functions/v1/channel-ical?action=export&property=${property.id}&token=${property.ical_export_token}`;
}

export async function getICalFeeds(propertyId?: string): Promise<ICalFeed[]> {
  let query = supabase
    .from('channel_ical_feeds')
    .select('*')
    .order('created_at', { ascending: false });
  if (propertyId) query = query.eq('property_id', propertyId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as ICalFeed[]) || [];
}

export async function addICalFeed(
  propertyId: string,
  feedUrl: string,
  label?: string
): Promise<ICalFeed> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('channel_ical_feeds')
    .insert({
      property_id: propertyId,
      user_id: session.session.user.id,
      feed_url: feedUrl.trim(),
      label: label?.trim() || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as ICalFeed;
}

export async function deleteICalFeed(feedId: string): Promise<void> {
  const { error } = await supabase.from('channel_ical_feeds').delete().eq('id', feedId);
  if (error) throw error;
}

export async function importICalFeeds(propertyId?: string): Promise<unknown> {
  return invokePMSEdgeFunction('channel-ical', {
    action: 'import',
    ...(propertyId ? { propertyId } : {}),
  });
}

export async function testHostawayConnection(connectionId: string): Promise<string> {
  const payload = await invokePMSEdgeFunction('pms-hostaway-sync', {
    action: 'test_hostaway',
    pmsConnectionId: connectionId,
  });
  const result = payload?.result as { listingCount?: number } | undefined;
  return `Hostaway connection OK. Found ${result?.listingCount ?? 0} listing(s).`;
}
