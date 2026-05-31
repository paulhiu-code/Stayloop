/*
  Multi-platform sync infrastructure (StayLoop ↔ OwnerRez ↔ Airbnb/VRBO).

  Adds outbound job queue, booking ID mappings, StayLoop-native calendar blocks,
  and database triggers that enqueue OwnerRez push jobs without calling the API.
  Outbound writes remain disabled until OWNERREZ_OUTBOUND_ENABLED=true on edge functions.
*/

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_source text NOT NULL DEFAULT 'stayloop'
    CHECK (booking_source IN ('stayloop', 'ownerrez', 'guesty', 'airbnb', 'vrbo', 'other'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS origin_platform text NOT NULL DEFAULT 'stayloop'
    CHECK (origin_platform IN ('stayloop', 'ownerrez', 'airbnb', 'vrbo', 'guesty', 'other'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS external_pms_booking_id text;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pms_connection_id uuid REFERENCES pms_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_external_pms
  ON bookings(external_pms_booking_id)
  WHERE external_pms_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_pms_connection
  ON bookings(pms_connection_id)
  WHERE pms_connection_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_pms_external_unique
  ON bookings(pms_connection_id, external_pms_booking_id)
  WHERE pms_connection_id IS NOT NULL AND external_pms_booking_id IS NOT NULL;

ALTER TABLE availability_calendar
  ADD COLUMN IF NOT EXISTS blocked_by_booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_availability_blocked_by_booking
  ON availability_calendar(blocked_by_booking_id)
  WHERE blocked_by_booking_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pms_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pms_connection_id uuid NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('booking', 'availability', 'property', 'pricing')),
  entity_id uuid,
  action text NOT NULL CHECK (action IN ('create', 'update', 'cancel', 'block_dates', 'unblock_dates')),
  sync_direction text NOT NULL DEFAULT 'to_pms' CHECK (sync_direction IN ('to_pms', 'from_pms')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  dry_run boolean NOT NULL DEFAULT true,
  result jsonb,
  error_message text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pms_sync_queue_pending
  ON pms_sync_queue(status, scheduled_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_pms_sync_queue_connection
  ON pms_sync_queue(pms_connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pms_booking_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pms_connection_id uuid NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
  stayloop_booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pms_property_id text NOT NULL,
  pms_booking_id text,
  sync_direction text NOT NULL DEFAULT 'bidirectional'
    CHECK (sync_direction IN ('to_pms', 'from_pms', 'bidirectional')),
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'dry_run', 'skipped')),
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pms_connection_id, stayloop_booking_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pms_booking_mappings_pms_id
  ON pms_booking_mappings(pms_connection_id, pms_booking_id)
  WHERE pms_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pms_booking_mappings_stayloop
  ON pms_booking_mappings(stayloop_booking_id);

UPDATE pms_connections
SET sync_settings = COALESCE(sync_settings, '{}'::jsonb) || '{"outbound": false}'::jsonb
WHERE sync_settings->>'outbound' IS NULL;

ALTER TABLE pms_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_booking_mappings ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION public.pms_booking_is_blocking(status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT status IN ('pending', 'confirmed', 'checked_in');
$$;

CREATE OR REPLACE FUNCTION public.block_calendar_for_booking(
  p_booking_id uuid,
  p_property_id uuid,
  p_check_in date,
  p_check_out date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  night date;
BEGIN
  night := p_check_in;
  WHILE night < p_check_out LOOP
    INSERT INTO availability_calendar (
      property_id,
      date,
      is_available,
      source,
      blocked_by_booking_id,
      synced_at
    )
    VALUES (
      p_property_id,
      night,
      false,
      'stayloop',
      p_booking_id,
      now()
    )
    ON CONFLICT (property_id, date) DO UPDATE SET
      is_available = false,
      source = 'stayloop',
      blocked_by_booking_id = p_booking_id,
      synced_at = now();

    night := night + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_calendar_for_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM availability_calendar
  WHERE blocked_by_booking_id = p_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_pms_outbound_job(
  p_connection_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_id uuid;
BEGIN
  INSERT INTO pms_sync_queue (
    pms_connection_id,
    entity_type,
    entity_id,
    action,
    sync_direction,
    payload,
    dry_run
  )
  VALUES (
    p_connection_id,
    p_entity_type,
    p_entity_id,
    p_action,
    'to_pms',
    p_payload,
    true
  )
  RETURNING id INTO job_id;

  RETURN job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_stayloop_booking_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapping record;
  was_blocking boolean;
  is_blocking boolean;
  guest_email text;
  guest_name text;
BEGIN
  was_blocking := TG_OP = 'UPDATE' AND public.pms_booking_is_blocking(OLD.status);
  is_blocking := public.pms_booking_is_blocking(NEW.status);

  IF is_blocking AND NOT was_blocking THEN
    PERFORM public.block_calendar_for_booking(
      NEW.id,
      NEW.property_id,
      NEW.check_in,
      NEW.check_out
    );
  END IF;

  IF was_blocking AND NOT is_blocking THEN
    PERFORM public.unblock_calendar_for_booking(NEW.id);
  END IF;

  IF NEW.booking_source IS DISTINCT FROM 'stayloop' THEN
    RETURN NEW;
  END IF;

  IF NOT is_blocking THEN
    RETURN NEW;
  END IF;

  SELECT email, full_name INTO guest_email, guest_name
  FROM profiles
  WHERE id = NEW.guest_id;

  FOR mapping IN
    SELECT
      pm.pms_connection_id,
      pm.pms_property_id,
      pc.pms_provider,
      pc.sync_settings
    FROM pms_property_mappings pm
    JOIN pms_connections pc ON pc.id = pm.pms_connection_id
    WHERE pm.stayloop_property_id = NEW.property_id
      AND pm.auto_sync_enabled = true
      AND pc.is_active = true
  LOOP
    INSERT INTO pms_booking_mappings (
      pms_connection_id,
      stayloop_booking_id,
      pms_property_id,
      sync_direction,
      sync_status,
      metadata
    )
    VALUES (
      mapping.pms_connection_id,
      NEW.id,
      mapping.pms_property_id,
      'bidirectional',
      'pending',
      jsonb_build_object(
        'origin_platform', NEW.origin_platform,
        'check_in', NEW.check_in,
        'check_out', NEW.check_out
      )
    )
    ON CONFLICT (pms_connection_id, stayloop_booking_id) DO UPDATE SET
      sync_status = CASE
        WHEN pms_booking_mappings.sync_status = 'synced' THEN pms_booking_mappings.sync_status
        ELSE 'pending'
      END,
      metadata = EXCLUDED.metadata,
      updated_at = now();

    IF was_blocking AND is_blocking AND TG_OP = 'UPDATE' THEN
      PERFORM public.enqueue_pms_outbound_job(
        mapping.pms_connection_id,
        'booking',
        NEW.id,
        'update',
        jsonb_build_object(
          'stayloop_booking_id', NEW.id,
          'pms_property_id', mapping.pms_property_id,
          'pms_provider', mapping.pms_provider,
          'check_in', NEW.check_in,
          'check_out', NEW.check_out,
          'num_guests', NEW.num_guests,
          'status', NEW.status,
          'guest_email', guest_email,
          'guest_name', guest_name,
          'total_amount', NEW.total_amount
        )
      );
    ELSIF NOT was_blocking AND is_blocking THEN
      PERFORM public.enqueue_pms_outbound_job(
        mapping.pms_connection_id,
        'booking',
        NEW.id,
        'create',
        jsonb_build_object(
          'stayloop_booking_id', NEW.id,
          'pms_property_id', mapping.pms_property_id,
          'pms_provider', mapping.pms_provider,
          'check_in', NEW.check_in,
          'check_out', NEW.check_out,
          'num_guests', NEW.num_guests,
          'status', NEW.status,
          'guest_email', guest_email,
          'guest_name', guest_name,
          'total_amount', NEW.total_amount
        )
      );
    END IF;
  END LOOP;

  IF was_blocking AND NOT is_blocking THEN
    FOR mapping IN
      SELECT pm.pms_connection_id, pm.pms_property_id, pc.pms_provider
      FROM pms_property_mappings pm
      JOIN pms_connections pc ON pc.id = pm.pms_connection_id
      WHERE pm.stayloop_property_id = NEW.property_id
        AND pm.auto_sync_enabled = true
        AND pc.is_active = true
    LOOP
      UPDATE pms_booking_mappings
      SET sync_status = 'pending', updated_at = now()
      WHERE pms_connection_id = mapping.pms_connection_id
        AND stayloop_booking_id = NEW.id;

      PERFORM public.enqueue_pms_outbound_job(
        mapping.pms_connection_id,
        'booking',
        NEW.id,
        'cancel',
        jsonb_build_object(
          'stayloop_booking_id', NEW.id,
          'pms_property_id', mapping.pms_property_id,
          'pms_provider', mapping.pms_provider,
          'check_in', NEW.check_in,
          'check_out', NEW.check_out,
          'status', NEW.status
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stayloop_booking_sync ON bookings;
CREATE TRIGGER trg_stayloop_booking_sync
  AFTER INSERT OR UPDATE OF status, check_in, check_out, num_guests ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_stayloop_booking_sync();
