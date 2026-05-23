/*
  Guest booking: public read for listings and availability calendars.
*/

CREATE POLICY "Anon can view active properties"
  ON properties FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Anon can view availability calendar"
  ON availability_calendar FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
      AND properties.is_active = true
    )
  );

ALTER TABLE availability_calendar
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'
    CHECK (source IN ('manual', 'ownerrez', 'guesty', 'stayloop'));

ALTER TABLE availability_calendar
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_availability_unavailable
  ON availability_calendar(property_id, date)
  WHERE is_available = false;
