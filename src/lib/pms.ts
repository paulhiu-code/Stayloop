import { supabase } from './supabase';

export type PMSProvider = 'ownerrez' | 'guesty';

export interface PMSConnection {
  id: string;
  user_id: string;
  pms_provider: PMSProvider;
  account_name: string | null;
  is_active: boolean;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: string | null;
  api_credentials: Record<string, unknown> | null;
  sync_settings: Record<string, unknown>;
  last_sync_at: string | null;
  sync_status: 'pending' | 'syncing' | 'completed' | 'failed';
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

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
  sync_type: 'property' | 'booking' | 'availability' | 'pricing' | 'full';
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

export const pmsProviders = [
  {
    id: 'ownerrez' as const,
    name: 'OwnerRez',
    logo: 'https://www.ownerrez.com/images/logo.svg',
    description: 'Connect your OwnerRez account to sync properties, bookings, and availability',
    features: ['Property Sync', 'Booking Sync', 'Calendar Sync', 'Real-time Webhooks'],
    setupUrl: 'https://www.ownerrez.com/support/articles/api-overview',
  },
  {
    id: 'guesty' as const,
    name: 'Guesty',
    logo: 'https://www.guesty.com/wp-content/themes/guesty/img/logo.svg',
    description: 'Integrate with Guesty for seamless property and reservation management',
    features: ['Listing Sync', 'Reservation Sync', 'Calendar Management', 'Multi-channel Support'],
    setupUrl: 'https://open-api-docs.guesty.com/',
  },
];

export async function createPMSConnection(
  provider: PMSProvider,
  accessToken: string,
  refreshToken?: string,
  accountName?: string
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
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPMSConnections(): Promise<PMSConnection[]> {
  const { data, error } = await supabase
    .from('pms_connections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function syncPMSProperties(connectionId: string): Promise<unknown> {
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('pms_provider')
    .eq('id', connectionId)
    .single();

  if (!connection) throw new Error('Connection not found');

  const functionName = connection.pms_provider === 'ownerrez'
    ? 'pms-ownerrez-sync'
    : 'pms-guesty-sync';

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: {
      action: 'sync_properties',
      pmsConnectionId: connectionId,
    },
  });

  if (error) throw error;
  return data;
}

export async function syncPMSBookings(connectionId: string, propertyId?: string): Promise<unknown> {
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('pms_provider')
    .eq('id', connectionId)
    .single();

  if (!connection) throw new Error('Connection not found');

  const functionName = connection.pms_provider === 'ownerrez'
    ? 'pms-ownerrez-sync'
    : 'pms-guesty-sync';

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

  const functionName = connection.pms_provider === 'ownerrez'
    ? 'pms-ownerrez-sync'
    : 'pms-guesty-sync';

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: {
      action: 'sync_availability',
      pmsConnectionId: connectionId,
      propertyId,
    },
  });

  if (error) throw error;
  return data;
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
