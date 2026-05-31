/*
  # Demo seed data for guest discovery and booking flows

  Skips automatically when real inventory already exists (production projects).
  For empty dev databases, run the seed statements manually or use showcase fallback.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM properties
    WHERE host_id <> '11111111-1111-1111-1111-111111111101'::uuid
  ) THEN
    RAISE NOTICE 'Demo seed skipped: production inventory already present';
    RETURN;
  END IF;

  RAISE NOTICE 'Demo seed target: empty database. Insert demo host/properties via local bootstrap if needed.';
END $$;
