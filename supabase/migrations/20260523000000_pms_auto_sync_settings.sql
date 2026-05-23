/*
  PMS automatic sync defaults and webhook processing metadata.
*/

ALTER TABLE pms_connections
  ALTER COLUMN sync_settings SET DEFAULT '{
    "properties": true,
    "bookings": true,
    "availability": true,
    "auto_sync": true
  }'::jsonb;

UPDATE pms_connections
SET sync_settings = COALESCE(sync_settings, '{}'::jsonb) || '{"auto_sync": true}'::jsonb
WHERE sync_settings->>'auto_sync' IS NULL;

ALTER TABLE pms_webhook_events
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
