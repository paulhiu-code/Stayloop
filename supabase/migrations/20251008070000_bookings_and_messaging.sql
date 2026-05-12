/*
  # Bookings and Messaging System

  1. Tables
    - bookings: Property bookings with payment tracking
    - property_availability: Calendar availability management
    - conversations: Message threads between users
    - messages: Individual messages

  2. Security
    - RLS enabled with appropriate policies

  3. Performance
    - Indexes on common query patterns
*/

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_availability_property_date ON property_availability(property_id, date);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_property ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Bookings policies
CREATE POLICY "Guests view own bookings" ON bookings FOR SELECT TO authenticated USING (auth.uid() = guest_id);
CREATE POLICY "Hosts view property bookings" ON bookings FOR SELECT TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "Guests create bookings" ON bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = guest_id);
CREATE POLICY "Guests update bookings" ON bookings FOR UPDATE TO authenticated USING (auth.uid() = guest_id) WITH CHECK (auth.uid() = guest_id);
CREATE POLICY "Hosts update property bookings" ON bookings FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

-- Availability policies
CREATE POLICY "Anyone view availability" ON property_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners manage availability" ON property_availability FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_availability.property_id AND host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_availability.property_id AND host_id = auth.uid()));

-- Conversations policies
CREATE POLICY "View own conversations" ON conversations FOR SELECT TO authenticated USING (auth.uid() IN (participant_1_id, participant_2_id));
CREATE POLICY "Create conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (participant_1_id, participant_2_id));
CREATE POLICY "Update conversations" ON conversations FOR UPDATE TO authenticated USING (auth.uid() IN (participant_1_id, participant_2_id)) WITH CHECK (auth.uid() IN (participant_1_id, participant_2_id));

-- Messages policies
CREATE POLICY "View messages" ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND auth.uid() IN (participant_1_id, participant_2_id)));

CREATE POLICY "Send messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND auth.uid() IN (participant_1_id, participant_2_id)));

CREATE POLICY "Update messages" ON messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND auth.uid() IN (participant_1_id, participant_2_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND auth.uid() IN (participant_1_id, participant_2_id)));
