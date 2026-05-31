/*
  Conversations table for host/guest messaging (booking threads + future inquiries).
  Links messages to conversation threads while keeping legacy booking_id support.
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_distinct_participants CHECK (participant_1_id <> participant_2_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_booking
  ON conversations(booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_participant_1
  ON conversations(participant_1_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_2
  ON conversations(participant_2_id, last_message_at DESC);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own conversations" ON conversations;
CREATE POLICY "View own conversations"
  ON conversations FOR SELECT TO authenticated
  USING (auth.uid() IN (participant_1_id, participant_2_id));

DROP POLICY IF EXISTS "Create conversations" ON conversations;
CREATE POLICY "Create conversations"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (participant_1_id, participant_2_id));

DROP POLICY IF EXISTS "Update own conversations" ON conversations;
CREATE POLICY "Update own conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (auth.uid() IN (participant_1_id, participant_2_id))
  WITH CHECK (auth.uid() IN (participant_1_id, participant_2_id));

DROP POLICY IF EXISTS "View messages" ON messages;
CREATE POLICY "View messages"
  ON messages FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.participant_1_id, conversations.participant_2_id)
    )
  );

DROP POLICY IF EXISTS "Send messages" ON messages;
CREATE POLICY "Send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = messages.conversation_id
          AND auth.uid() IN (conversations.participant_1_id, conversations.participant_2_id)
      )
    )
  );

DROP POLICY IF EXISTS "Update messages" ON messages;
CREATE POLICY "Update messages"
  ON messages FOR UPDATE TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.participant_1_id, conversations.participant_2_id)
    )
  )
  WITH CHECK (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.participant_1_id, conversations.participant_2_id)
    )
  );
