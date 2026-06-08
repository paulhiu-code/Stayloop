import {
  SITE_URL,
  accountDedupeKey,
  dispatchTrigger,
} from './email-dispatch.js';

export async function sendWelcomeEmail(pool, { userId, email, fullName, userType }) {
  const isHost = userType === 'host' || userType === 'both';
  const triggerSlug = isHost ? 'account.welcome.host' : 'account.welcome.guest';
  const name = fullName || (isHost ? 'Host' : 'Guest');

  return dispatchTrigger(pool, {
    triggerSlug,
    to: email,
    dedupeKey: accountDedupeKey(userId, triggerSlug),
    variables: {
      guest_name: name,
      host_name: name,
      site_url: SITE_URL,
    },
  });
}

export async function sendNewMessageEmail(pool, {
  messageId,
  recipientEmail,
  recipientRole,
  recipientName,
  senderName,
  propertyTitle,
  messagePreview,
}) {
  const triggerSlug = recipientRole === 'host' ? 'message.new.host' : 'message.new.guest';

  return dispatchTrigger(pool, {
    triggerSlug,
    to: recipientEmail,
    dedupeKey: `message:${messageId}:${triggerSlug}`,
    variables: {
      guest_name: recipientRole === 'guest' ? recipientName : senderName,
      host_name: recipientRole === 'host' ? recipientName : senderName,
      property_title: propertyTitle || 'Your stay',
      message_preview: messagePreview?.slice(0, 280) || 'You have a new message.',
      conversation_url: `${SITE_URL}/dashboard`,
      site_url: SITE_URL,
    },
  });
}

export async function sendPmsSyncFailedEmail(pool, {
  hostUserId,
  hostEmail,
  hostName,
  pmsProvider,
  syncError,
}) {
  return dispatchTrigger(pool, {
    triggerSlug: 'pms.sync.failed',
    to: hostEmail,
    dedupeKey: `pms-sync:${hostUserId}:${new Date().toISOString().slice(0, 13)}`,
    variables: {
      host_name: hostName || 'Host',
      pms_provider: pmsProvider || 'PMS',
      sync_error: syncError?.slice(0, 500) || 'Sync failed.',
      pms_settings_url: `${SITE_URL}/dashboard`,
      site_url: SITE_URL,
    },
  });
}
