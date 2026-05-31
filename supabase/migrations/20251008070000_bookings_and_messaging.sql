/*
  # Bookings performance indexes

  Replaces the previous broken migration that referenced non-existent tables
  (property_availability, conversations). Keeps only safe indexes on existing tables.
*/

CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_messages_booking_created ON messages(booking_id, created_at DESC);
