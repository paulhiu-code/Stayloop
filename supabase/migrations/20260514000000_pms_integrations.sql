/*
  # PMS Integration Tables

  Adds the production tables needed to connect OwnerRez/Guesty accounts, map
  external PMS records to StayLoop records, and audit sync/webhook activity.
*/

CREATE TABLE IF NOT EXISTS pms_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pms_provider text NOT NULL CHECK (pms_provider IN ('ownerrez', 'guesty')),
  account_name text,
  is_active boolean NOT NULL DEFAULT true,
  oauth_access_token text,
  oauth_refresh_token text,
  oauth_expires_at timestamptz,
  api_credentials jsonb,
  sync_settings jsonb NOT NULL DEFAULT '{"properties": true, "bookings": true, "availability": true}'::jsonb,
  last_sync_at timestamptz,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pms_property_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pms_connection_id uuid NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
  stayloop_property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  pms_property_id text NOT NULL,
  pms_property_data jsonb,
  sync_direction text NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('to_pms', 'from_pms', 'bidirectional')),
  auto_sync_enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pms_connection_id, pms_property_id),
  UNIQUE (pms_connection_id, stayloop_property_id)
);

CREATE TABLE IF NOT EXISTS pms_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pms_connection_id uuid NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
  pms_property_mapping_id uuid REFERENCES pms_property_mappings(id) ON DELETE SET NULL,
  sync_type text NOT NULL CHECK (sync_type IN ('property', 'booking', 'availability', 'pricing', 'full', 'webhook')),
  sync_direction text NOT NULL DEFAULT 'from_pms' CHECK (sync_direction IN ('to_pms', 'from_pms')),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  records_processed integer NOT NULL DEFAULT 0,
  records_succeeded integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  error_details jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pms_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pms_connection_id uuid NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pms_connections_user ON pms_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_pms_connections_provider ON pms_connections(pms_provider);
CREATE INDEX IF NOT EXISTS idx_pms_property_mappings_connection ON pms_property_mappings(pms_connection_id);
CREATE INDEX IF NOT EXISTS idx_pms_property_mappings_stayloop_property ON pms_property_mappings(stayloop_property_id);
CREATE INDEX IF NOT EXISTS idx_pms_sync_logs_connection_created ON pms_sync_logs(pms_connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pms_webhook_events_connection_created ON pms_webhook_events(pms_connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pms_webhook_events_unprocessed ON pms_webhook_events(processed, created_at) WHERE processed = false;

ALTER TABLE pms_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_property_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own PMS connections" ON pms_connections;
CREATE POLICY "Users manage own PMS connections"
  ON pms_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own PMS mappings" ON pms_property_mappings;
CREATE POLICY "Users view own PMS mappings"
  ON pms_property_mappings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM pms_connections
      WHERE pms_connections.id = pms_property_mappings.pms_connection_id
        AND pms_connections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own PMS sync logs" ON pms_sync_logs;
CREATE POLICY "Users view own PMS sync logs"
  ON pms_sync_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM pms_connections
      WHERE pms_connections.id = pms_sync_logs.pms_connection_id
        AND pms_connections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own PMS webhook events" ON pms_webhook_events;
CREATE POLICY "Users view own PMS webhook events"
  ON pms_webhook_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM pms_connections
      WHERE pms_connections.id = pms_webhook_events.pms_connection_id
        AND pms_connections.user_id = auth.uid()
    )
  );
