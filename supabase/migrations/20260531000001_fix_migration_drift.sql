/*
  Fix drift from 20251008070000_bookings_and_messaging.sql which references
  non-existent property_availability and conversations objects.
  Restores valid messages policies from the initial schema.
*/

-- Remove ghost tables if a partial apply created them (policies drop with CASCADE)
DROP TABLE IF EXISTS public.property_availability CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

-- Drop orphaned indexes from the broken migration (safe no-ops when absent)
DROP INDEX IF EXISTS public.idx_bookings_property;
DROP INDEX IF EXISTS public.idx_bookings_guest;
DROP INDEX IF EXISTS public.idx_bookings_host;
DROP INDEX IF EXISTS public.idx_conversations_participants;
DROP INDEX IF EXISTS public.idx_conversations_property;
DROP INDEX IF EXISTS public.idx_messages_conversation;

-- Drop duplicate/conflicting booking policies if the broken migration partially ran
DROP POLICY IF EXISTS "Guests view own bookings" ON bookings;
DROP POLICY IF EXISTS "Hosts view property bookings" ON bookings;
DROP POLICY IF EXISTS "Guests create bookings" ON bookings;
DROP POLICY IF EXISTS "Guests update bookings" ON bookings;
DROP POLICY IF EXISTS "Hosts update property bookings" ON bookings;

-- Drop conversation-scoped message policies from the broken migration
DROP POLICY IF EXISTS "View messages" ON messages;
DROP POLICY IF EXISTS "Send messages" ON messages;
DROP POLICY IF EXISTS "Update messages" ON messages;

-- Ensure initial-schema messages policies remain in effect
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipients can update message read status" ON messages;
CREATE POLICY "Recipients can update message read status"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Remove conversation_id column if a later partial migration added it without the table
ALTER TABLE messages DROP COLUMN IF EXISTS conversation_id;
