import { useTranslation } from 'react-i18next';

const en = {
  compose: 'Compose a WhatsApp message',
  contact: 'Contact',
  message: 'Message',
  send: 'Send WhatsApp message',
  sending: 'Sending…',
  sent: 'WhatsApp message sent',
  sendFailed: 'WhatsApp message could not be sent',
  messageRequired: 'Enter a WhatsApp message',
  approvalDraft: 'Email draft for WhatsApp approval (optional)',
  approvalHelp: 'Bind the preceding draft ID to send the complete email for review. Only the configured contact can reply APPROVE or REJECT with its unique code. Draft changes invalidate approval. Leave empty for an ordinary message.',
  recipientBinding: 'Recipient binding (optional)',
  recipientHelp:
    'Leave empty to reply to the triggering WhatsApp contact. For a compose workflow, bind the selected CRM contact, for example {{ input.customerId }}.',
  description:
    'Receive WhatsApp messages, sync contacts, and trigger workflows through OpenWA.',
  setup:
    'This connection is managed by your CRM server. The connected WhatsApp session delivers messages to its configured inbox below.',
  usage:
    'Reply with text in the inbox. Files, voice notes, and polls can be viewed or sent from WhatsApp. Group chats and status broadcasts are excluded.',
  pairing: 'Link your phone in OpenWA to begin receiving messages.',
  dashboard: 'Open OpenWA',
  connect: 'Connect WhatsApp inbox',
  connecting: 'Connecting…',
  connected: 'WhatsApp inbox connected',
  connectFailed: 'WhatsApp inbox could not be connected',
  connectionName: 'Inbox name',
  brand: 'Brand',
  chooseBrand: 'Choose a brand',
  channelRequired: 'Open this page from a channel to connect WhatsApp.',
  trigger:
    'Starts for each incoming direct WhatsApp message in the connected OpenWA inbox. Group messages, status broadcasts, and messages sent by your own account are excluded. The trigger supplies the contact, conversation, message content, and phone number when available.',
};

export const useOpenwaTranslation = () => {
  const { i18n } = useTranslation();
  if (!i18n.hasResourceBundle('en', 'frontline-openwa'))
    i18n.addResourceBundle('en', 'frontline-openwa', en);
  return {
    t: (key: keyof typeof en) =>
      i18n.t(key, { ns: 'frontline-openwa', defaultValue: en[key] }),
  };
};
