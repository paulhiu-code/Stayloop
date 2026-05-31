/*
  # PMS-imported reviews from OwnerRez

  Allows importing channel reviews without a StayLoop guest account or booking row.
*/

ALTER TABLE reviews ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE reviews ALTER COLUMN reviewer_id DROP NOT NULL;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS external_pms_review_id text,
  ADD COLUMN IF NOT EXISTS external_pms_provider text,
  ADD COLUMN IF NOT EXISTS guest_reviewer_name text,
  ADD COLUMN IF NOT EXISTS review_source text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_external_pms
  ON reviews(property_id, external_pms_review_id)
  WHERE external_pms_review_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_external_provider
  ON reviews(external_pms_provider, external_pms_review_id)
  WHERE external_pms_review_id IS NOT NULL;

-- Extend sync log types for review imports
ALTER TABLE pms_sync_logs DROP CONSTRAINT IF EXISTS pms_sync_logs_sync_type_check;
ALTER TABLE pms_sync_logs ADD CONSTRAINT pms_sync_logs_sync_type_check
  CHECK (sync_type IN ('property', 'booking', 'availability', 'pricing', 'full', 'webhook', 'review'));
