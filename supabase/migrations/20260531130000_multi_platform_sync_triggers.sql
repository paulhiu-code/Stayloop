/*
  Multi-platform sync triggers + calendar blocks (delta on str_parity schema).

  Adds StayLoop-native calendar blocking, booking lifecycle triggers, and
  outbound queue dry-run support. Compatible with existing pms_sync_queue
  columns (direction, scheduled_for, last_error, processed_at).
*/

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS origin_platform text NOT NULL DEFAULT 'stayloop';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pms_connection_id uuid REFERENCES pms_connections(id) ON DELETE SET NULL;

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

ALTER TABLE pms_booking_mappings
  ADD COLUMN IF NOT EXISTS pms_property_id text;

ALTER TABLE pms_booking_mappings
  ADD COLUMN IF NOT EXISTS sync_direction text NOT NULL DEFAULT 'bidirectional';

ALTER TABLE pms_booking_mappings
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE pms_booking_mappings
  ALTER COLUMN pms_booking_id DROP NOT NULL;

ALTER TABLE pms_sync_queue
  ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT true;

ALTER TABLE pms_sync_queue
  ADD COLUMN IF NOT EXISTS result jsonb;

UPDATE pms_connections
SET sync_settings = COALESCE(sync_settings, '{}'::jsonb) || '{"outbound": false}'::jsonb
WHERE sync_settings->>'outbound' IS NULL;

ALTER TABLE pms_booking_mappings DROP CONSTRAINT IF EXISTS pms_booking_mappings_sync_status_check;
ALTER TABLE pms_booking_mappings ADD CONSTRAINT pms_booking_mappings_sync_status_check
  CHECK (sync_status IN ('pending', 'synced', 'failed', 'conflict', 'dry_run', 'skipped'));

ALTER TABLE pms_sync_queue DROP CONSTRAINT IF EXISTS pms_sync_queue_action_check;
ALTER TABLE pms_sync_queue ADD CONSTRAINT pms_sync_queue_action_check
  CHECK (action IN ('create', 'update', 'cancel', 'sync', 'block_dates', 'unblock_dates'));

ALTER TABLE pms_sync_queue DROP CONSTRAINT IF EXISTS pms_sync_queue_status_check;
ALTER TABLE pms_sync_queue ADD CONSTRAINT pms_sync_queue_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));

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
    direction,
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
      pms_booking_id,
      sync_direction,
      sync_status,
      metadata
    )
    VALUES (
      mapping.pms_connection_id,
      NEW.id,
      mapping.pms_property_id,
      NULL,
      'bidirectional',
      'pending',
      jsonb_build_object(
        'origin_platform', NEW.origin_platform,
        'check_in', NEW.check_in,
        'check_out', NEW.check_out
      )
    )
    ON CONFLICT (pms_connection_id, stayloop_booking_id) DO UPDATE SET
      pms_property_id = EXCLUDED.pms_property_id,
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
