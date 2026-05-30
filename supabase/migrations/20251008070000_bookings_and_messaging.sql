/*
  # Bookings and Messaging — performance indexes

  Legacy note: an earlier draft of this migration referenced property_availability
  and conversations tables that were never created. StayLoop uses
  availability_calendar (from the initial schema) and booking-linked messages
  instead. This file now only adds idempotent indexes.
*/

CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
