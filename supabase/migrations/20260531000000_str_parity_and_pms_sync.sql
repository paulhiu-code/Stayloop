/*
  # STR platform parity + OwnerRez bidirectional sync schema

  Adds listing, booking, and PMS sync columns needed for Airbnb/VRBO-level
  functionality and live OwnerRez integration (import + future outbound sync).
*/

-- ── Properties: listing detail parity ──────────────────────────────────────

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS check_in_time time,
  ADD COLUMN IF NOT EXISTS check_out_time time,
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS max_adults integer,
  ADD COLUMN IF NOT EXISTS max_children integer,
  ADD COLUMN IF NOT EXISTS max_pets integer,
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_pms_property_id text,
  ADD COLUMN IF NOT EXISTS external_pms_provider text;

-- Widen property_type to accept common STR/PMS labels
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_type_check;
ALTER TABLE properties ADD CONSTRAINT properties_property_type_check
  CHECK (property_type IN (
    'house', 'apartment', 'condo', 'villa', 'cabin', 'cottage',
    'townhouse', 'loft', 'other',
    'entire_home', 'private_room', 'shared_room', 'hotel_room',
    'unique_stay', 'studio', 'bungalow', 'chalet', 'farm_stay'
  ));

CREATE INDEX IF NOT EXISTS idx_properties_external_pms
  ON properties(external_pms_provider, external_pms_property_id)
  WHERE external_pms_property_id IS NOT NULL;

-- ── Bookings: PMS + channel parity ─────────────────────────────────────────

-- PMS-imported bookings may not have a StayLoop guest account
ALTER TABLE bookings ALTER COLUMN guest_id DROP NOT NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS external_pms_booking_id text,
  ADD COLUMN IF NOT EXISTS external_pms_provider text,
  ADD COLUMN IF NOT EXISTS booking_source text NOT NULL DEFAULT 'stayloop',
  ADD COLUMN IF NOT EXISTS is_block boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_direction text NOT NULL DEFAULT 'native'
    CHECK (sync_direction IN ('native', 'from_pms', 'to_pms'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_external_pms
  ON bookings(property_id, external_pms_booking_id)
  WHERE external_pms_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_booking_source
  ON bookings(booking_source);

CREATE INDEX IF NOT EXISTS idx_bookings_synced_at
  ON bookings(synced_at DESC)
  WHERE synced_at IS NOT NULL;

-- ── PMS booking ID mapping (StayLoop ↔ OwnerRez) ────────────────────────────

CREATE TABLE IF NOT EXISTS pms_booking_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pms_connection_id uuid NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
  stayloop_booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pms_booking_id text NOT NULL,
  pms_quote_id text,
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'conflict')),
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pms_connection_id, pms_booking_id),
  UNIQUE (pms_connection_id, stayloop_booking_id)
);

CREATE INDEX IF NOT EXISTS idx_pms_booking_mappings_stayloop
  ON pms_booking_mappings(stayloop_booking_id);

-- ── Outbound sync queue (StayLoop → OwnerRez) ───────────────────────────────

CREATE TABLE IF NOT EXISTS pms_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pms_connection_id uuid NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
  entity_type text NOT NULL
    CHECK (entity_type IN ('property', 'booking', 'availability', 'pricing')),
  entity_id uuid,
  direction text NOT NULL DEFAULT 'to_pms'
    CHECK (direction IN ('to_pms', 'from_pms')),
  action text NOT NULL
    CHECK (action IN ('create', 'update', 'cancel', 'sync')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pms_sync_queue_pending
  ON pms_sync_queue(status, scheduled_for)
  WHERE status IN ('pending', 'processing');

-- ── RLS for new tables ──────────────────────────────────────────────────────

ALTER TABLE pms_booking_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own PMS booking mappings" ON pms_booking_mappings;
CREATE POLICY "Users view own PMS booking mappings"
  ON pms_booking_mappings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pms_connections
      WHERE pms_connections.id = pms_booking_mappings.pms_connection_id
        AND pms_connections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own PMS sync queue" ON pms_sync_queue;
CREATE POLICY "Users view own PMS sync queue"
  ON pms_sync_queue FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pms_connections
      WHERE pms_connections.id = pms_sync_queue.pms_connection_id
        AND pms_connections.user_id = auth.uid()
    )
  );
