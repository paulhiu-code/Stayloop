import { supabase } from './supabase';
import type { Booking, Profile } from './supabase';

export type Conversation = {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  property_id: string | null;
  booking_id: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string | null;
  booking_id: string | null;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

export type ConversationThread = Conversation & {
  property: { id: string; title: string; city: string; state: string; images: unknown } | null;
  booking: Pick<Booking, 'id' | 'check_in' | 'check_out' | 'status'> | null;
  otherParticipant: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
  lastMessage: Message | null;
  unreadCount: number;
};

function otherParticipantId(conversation: Conversation, userId: string): string {
  return conversation.participant_1_id === userId
    ? conversation.participant_2_id
    : conversation.participant_1_id;
}

export async function fetchConversationThreads(userId: string): Promise<ConversationThread[]> {
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(
      `
      *,
      property:properties(id, title, city, state, images),
      booking:bookings(id, check_in, check_out, status)
    `
    )
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  if (!conversations?.length) return [];

  const threads: ConversationThread[] = [];

  for (const row of conversations) {
    const conversation = row as Conversation & {
      property: ConversationThread['property'];
      booking: ConversationThread['booking'];
    };

    const otherId = otherParticipantId(conversation, userId);
    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', otherId)
      .maybeSingle();

    const { data: lastMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const { count: unreadCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)
      .eq('recipient_id', userId)
      .eq('is_read', false);

    threads.push({
      ...conversation,
      otherParticipant: otherProfile,
      lastMessage: (lastMessages?.[0] as Message) || null,
      unreadCount: unreadCount || 0,
    });
  }

  return threads;
}

export async function fetchConversationMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as Message[];
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

export async function sendConversationMessage(
  conversationId: string,
  senderId: string,
  recipientId: string,
  content: string,
  bookingId?: string | null
) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      booking_id: bookingId ?? null,
      sender_id: senderId,
      recipient_id: recipientId,
      content: trimmed,
      is_read: false,
    })
    .select('*')
    .single();

  if (error || !data) throw error || new Error('Failed to send message');

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as Message;
}

export async function getOrCreateBookingConversation(
  booking: Pick<Booking, 'id' | 'property_id' | 'guest_id' | 'host_id' | 'guest_user_id' | 'host_user_id'>
): Promise<Conversation | null> {
  const guestId = booking.guest_id || booking.guest_user_id;
  const hostId = booking.host_id || booking.host_user_id;

  if (!guestId || !hostId) return null;

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('booking_id', booking.id)
    .maybeSingle();

  if (existing) return existing as Conversation;

  const [p1, p2] = guestId < hostId ? [guestId, hostId] : [hostId, guestId];

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_1_id: p1,
      participant_2_id: p2,
      property_id: booking.property_id,
      booking_id: booking.id,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Conversation;
}

export async function ensureBookingConversations(
  bookings: Array<
    Pick<Booking, 'id' | 'property_id' | 'guest_id' | 'host_id' | 'guest_user_id' | 'host_user_id'>
  >
) {
  for (const booking of bookings) {
    try {
      await getOrCreateBookingConversation(booking);
    } catch (error) {
      console.error(`Failed to ensure conversation for booking ${booking.id}:`, error);
    }
  }
}
