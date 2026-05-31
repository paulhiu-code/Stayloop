import { FormEvent, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import {
  fetchConversationMessages,
  fetchConversationThreads,
  markConversationRead,
  sendConversationMessage,
  type ConversationThread,
  type Message,
} from '../lib/messaging';
import { propertyCoverImage } from '../lib/dashboard';
import type { BookingWithProperty } from '../lib/dashboard';

type MessagesPanelProps = {
  userId: string;
  bookings?: BookingWithProperty[];
  onEnsureConversations?: () => Promise<void>;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MessagesPanel({
  userId,
  bookings = [],
  onEnsureConversations,
}: MessagesPanelProps) {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const selectedThread = threads.find((thread) => thread.id === selectedId) || null;
  const messageableBookings = bookings.filter(
    (booking) => (booking.guest_id || booking.guest_user_id) && (booking.host_id || booking.host_user_id)
  );

  async function loadThreads() {
    setLoading(true);
    setError('');
    try {
      if (onEnsureConversations) {
        await onEnsureConversations();
      }
      const nextThreads = await fetchConversationThreads(userId);
      setThreads(nextThreads);
      if (!selectedId && nextThreads.length > 0) {
        setSelectedId(nextThreads[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    const nextMessages = await fetchConversationMessages(conversationId);
    setMessages(nextMessages);
    await markConversationRead(conversationId, userId);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === conversationId ? { ...thread, unreadCount: 0 } : thread
      )
    );
  }

  useEffect(() => {
    void loadThreads();
  }, [userId, bookings.length]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!selectedThread || !draft.trim()) return;

    const recipientId =
      selectedThread.participant_1_id === userId
        ? selectedThread.participant_2_id
        : selectedThread.participant_1_id;

    setSending(true);
    setError('');
    try {
      const message = await sendConversationMessage(
        selectedThread.id,
        userId,
        recipientId,
        draft,
        selectedThread.booking_id
      );
      setMessages((current) => [...current, message]);
      setDraft('');
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading conversations...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</div>}

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <MessageSquare className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-gray-600">No conversations yet.</p>
          <p className="mt-2 text-sm text-gray-500">
            {messageableBookings.length > 0
              ? 'Start a thread from a reservation with a StayLoop guest account, or wait for your first native booking.'
              : 'Messages appear for StayLoop bookings where both guest and host have accounts. Channel-only reservations stay in OwnerRez for now.'}
          </p>
        </div>
      ) : (
        <div className="grid min-h-[420px] overflow-hidden rounded-2xl border border-gray-200 lg:grid-cols-[280px_1fr]">
          <div className="border-b border-gray-200 bg-gray-50 lg:border-b-0 lg:border-r">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-bold uppercase tracking-wide text-gray-500">
              Conversations
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {threads.map((thread) => {
                const title = thread.property?.title || 'Reservation thread';
                const cover = propertyCoverImage(thread.property?.images);
                const active = thread.id === selectedId;
                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedId(thread.id)}
                    className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-4 text-left transition ${
                      active ? 'bg-white' : 'hover:bg-white/70'
                    }`}
                  >
                    {cover ? (
                      <img src={cover} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-200">
                        <MessageSquare className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-gray-900">{title}</p>
                        {thread.unreadCount > 0 && (
                          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-gray-500">
                        {thread.otherParticipant?.full_name || thread.otherParticipant?.email || 'Guest'}
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-400">
                        {thread.lastMessage?.content || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-[420px] flex-col">
            {selectedThread ? (
              <>
                <div className="border-b border-gray-200 px-5 py-4">
                  <p className="font-bold text-gray-900">
                    {selectedThread.property?.title || 'Reservation conversation'}
                  </p>
                  <p className="text-sm text-gray-500">
                    With {selectedThread.otherParticipant?.full_name || selectedThread.otherParticipant?.email}
                    {selectedThread.booking
                      ? ` · ${selectedThread.booking.check_in} → ${selectedThread.booking.check_out}`
                      : ''}
                  </p>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {messages.length === 0 ? (
                    <p className="text-sm text-gray-500">Send the first message in this thread.</p>
                  ) : (
                    messages.map((message) => {
                      const mine = message.sender_id === userId;
                      return (
                        <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                              mine
                                ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p>{message.content}</p>
                            <p className={`mt-1 text-xs ${mine ? 'text-white/80' : 'text-gray-500'}`}>
                              {formatTimestamp(message.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleSend} className="border-t border-gray-200 p-4">
                  <div className="flex gap-3">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-3"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-gray-500">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
