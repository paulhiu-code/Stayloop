/*
  # PMS Channel Integration — Hostaway, iCal, and two-way (outbound) sync

  Extends the PMS layer so StayLoop can behave like an Airbnb/VRBO channel:
    1. Add `hostaway` as a supported provider.
    2. Add `ical` + `hostaway` calendar sources.
    3. Track outbound reservation pushes (StayLoop booking -> PMS) for idempotency.
    4. Universal iCal channel: external feeds to import + per-property export token.
    5. Per-connection sync direction (inbound / outbound / two_way).
*/

-- 1. Provider + sync direction ------------------------------------------------

ALTER TABLE pms_connections
  DROP CONSTRAINT IF EXISTS pms_connections_pms_provider_check;

ALTER TABLE pms_connections
  ADD CONSTRAINT pms_connections_pms_provider_check
  CHECK (pms_provider IN ('ownerrez', 'guesty', 'hostaway'));

ALTER TABLE pms_connections
  ADD COLUMN IF NOT EXISTS sync_direction text NOT NULL DEFAULT 'two_way'
    CHECK (sync_direction IN ('inbound', 'outbound', 'two_way'));

-- Table-level SELECT was revoked in a prior hardening migration; grant the new
-- non-secret column so the client can read it.
GRANT SELECT (sync_direction) ON public.pms_connections TO authenticated;

-- 2. Calendar sources ---------------------------------------------------------

ALTER TABLE availability_calendar
  DROP CONSTRAINT IF EXISTS availability_calendar_source_check;

ALTER TABLE availability_calendar
  ADD CONSTRAINT availability_calendar_source_check
  CHECK (source IN ('manual', 'ownerrez', 'guesty', 'hostaway', 'ical', 'stayloop'));

-- 3. Outbound reservation mappings (StayLoop booking -> PMS reservation) -------

CREATE TABLE IF NOT EXISTS pms_reservation_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pms_connection_id uuid NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
  pms_property_mapping_id uuid REFERENCES pms_property_mappings(id) ON DELETE SET NULL,
  pms_reservation_id text,
  push_type text NOT NULL DEFAULT 'reservation'
    CHECK (push_type IN ('reservation', 'calendar_block')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pushed', 'failed', 'skipped')),
  last_error text,
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, pms_connection_id)
);

CREATE INDEX IF NOT EXISTS idx_pms_reservation_mappings_booking
  ON pms_reservation_mappings(booking_id);
CREATE INDEX IF NOT EXISTS idx_pms_reservation_mappings_connection
  ON pms_reservation_mappings(pms_connection_id);

ALTER TABLE pms_reservation_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own PMS reservation mappings" ON pms_reservation_mappings;
CREATE POLICY "Users view own PMS reservation mappings"
  ON pms_reservation_mappings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM pms_connections
      WHERE pms_connections.id = pms_reservation_mappings.pms_connection_id
        AND pms_connections.user_id = auth.uid()
    )
  );

-- 4. Universal iCal channel ---------------------------------------------------

-- 4a. Import: external .ics feeds the host wants StayLoop to honour.
CREATE TABLE IF NOT EXISTS channel_ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text,
  feed_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_imported_at timestamptz,
  last_import_status text
    CHECK (last_import_status IN ('success', 'failed') OR last_import_status IS NULL),
  last_import_error text,
  last_event_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, feed_url)
);

CREATE INDEX IF NOT EXISTS idx_channel_ical_feeds_property
  ON channel_ical_feeds(property_id);
CREATE INDEX IF NOT EXISTS idx_channel_ical_feeds_user
  ON channel_ical_feeds(user_id);

ALTER TABLE channel_ical_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own iCal feeds" ON channel_ical_feeds;
CREATE POLICY "Hosts manage own iCal feeds"
  ON channel_ical_feeds FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4b. Export: an unguessable token so StayLoop can publish a public .ics feed.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS ical_export_token text;

UPDATE properties
SET ical_export_token = encode(gen_random_bytes(24), 'hex')
WHERE ical_export_token IS NULL;

ALTER TABLE properties
  ALTER COLUMN ical_export_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_ical_export_token
  ON properties(ical_export_token);
