import { z } from 'zod';
import { sendTRPCMessage } from 'erxes-api-shared/utils';
import { generateModels } from '~/connectionResolvers';
import type {
  IMessage,
  IMessageDocument,
} from '@/inbox/@types/conversationMessages';
import type { IConversation } from '@/inbox/@types/conversations';
import { pConversationClientMessageInserted } from '@/inbox/graphql/resolvers/mutations/widget';
import { getOpenwaConfig, openwaHtml, openwaId } from './contract';

export const composeOpenwaSchema = z.object({
  customerId: z.string().min(1),
  text: z.string().trim().min(1).max(4096),
  requestId: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

/** Sends from CRM, retaining one canonical conversation and message per request. */
export const composeOpenwaMessage = async (
  subdomain: string,
  input: z.infer<typeof composeOpenwaSchema>,
  actor: { userId?: string; fromBot?: boolean },
  replyTo?: { chatId: string; conversationId: string },
): Promise<IMessageDocument> => {
  const config = getOpenwaConfig();
  if (subdomain !== config.subdomain) throw new Error('OpenWA tenant mismatch');
  const doc = composeOpenwaSchema.parse(input);
  const models = await generateModels(subdomain);
  const integration = await models.Integrations.findOne({
    _id: config.integrationId,
    kind: 'openwa-messenger',
    isActive: { $ne: false },
  });
  if (!integration) throw new Error('OpenWA integration is unavailable');
  const customer: unknown = await sendTRPCMessage({
    subdomain,
    pluginName: 'core',
    module: 'customers',
    action: 'findOne',
    method: 'query',
    input: { query: { _id: doc.customerId } },
  });
  const contact = z
    .object({ _id: z.string(), primaryPhone: z.string().nullish() })
    .parse(customer);
  if (contact._id !== doc.customerId) throw new Error('OpenWA contact mismatch');
  let chatId: string;
  if (replyTo) {
    if (!/^\d{1,32}@(c\.us|s\.whatsapp\.net|lid)$/.test(replyTo.chatId))
      throw new Error('Invalid direct WhatsApp reply target');
    const expected = openwaId('chat', config.integrationId, replyTo.chatId);
    if (
      replyTo.conversationId !== expected ||
      !(await models.Conversations.exists({
        _id: expected,
        integrationId: config.integrationId,
        customerId: contact._id,
      }))
    )
      throw new Error('WhatsApp reply target does not belong to this contact');
    chatId = replyTo.chatId;
  } else {
    const phone = (contact.primaryPhone || '').replace(/^\+/, '').replace(/^00/, '');
    if (!/^[1-9]\d{6,14}$/.test(phone))
      throw new Error('Contact needs an international WhatsApp phone number');
    chatId = `${phone}@c.us`;
  }
  const conversationId = openwaId('chat', config.integrationId, chatId);
  const messageId = openwaId('outbound', config.integrationId, doc.requestId);
  const previous = await models.ConversationMessages.findOne({
    _id: messageId,
  });
  if (previous) {
    if (
      previous.conversationId !== conversationId ||
      previous.content !== openwaHtml(doc.text)
    )
      throw new Error(
        'This request ID was already used for a different message',
      );
    await pConversationClientMessageInserted(subdomain, previous);
    return previous;
  }
  if (!(await models.Conversations.exists({ _id: conversationId }))) {
    const conversation: IConversation & { _id: string } = {
      _id: conversationId,
      integrationId: integration._id,
      customerId: contact._id,
      content: '',
      status: 'open',
      readUserIds: actor.userId ? [actor.userId] : [],
    };
    try {
      await models.Conversations.createConversation(conversation);
    } catch (error: unknown) {
      if (
        !(await models.Conversations.exists({
          _id: conversationId,
          integrationId: integration._id,
        }))
      )
        throw error;
    }
  }
  const response = await fetch(
    `${config.baseUrl.replace(/\/$/, '')}/api/sessions/${encodeURIComponent(
      config.sessionId,
    )}/messages/send-text`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': messageId,
      },
      body: JSON.stringify({ chatId, text: doc.text }),
    },
  );
  if (!response.ok)
    throw new Error(
      `OpenWA send failed (HTTP ${response.status}). Retry only with the same request ID.`,
    );
  const provider: unknown = await response.json();
  const providerResult = z
    .object({ messageId: z.string().min(1) })
    .passthrough()
    .parse(provider);
  const message: IMessage & { _id: string } = {
    _id: messageId,
    conversationId,
    content: openwaHtml(doc.text),
    contentType: 'text',
    userId: actor.userId,
    fromBot: actor.fromBot,
    deliveryStatus: 'sent',
    extraData: {
      openwa: {
        chatId,
        messageId: providerResult.messageId,
        requestId: doc.requestId,
      },
    },
  };
  let saved: IMessageDocument;
  try {
    saved = await models.ConversationMessages.createMessage(message);
  } catch (error: unknown) {
    const recovered = await models.ConversationMessages.findOne({
      _id: messageId,
      conversationId,
    });
    if (!recovered) throw error;
    saved = recovered;
  }
  await models.Conversations.updateConversation(conversationId, {
    content: saved.content,
    updatedAt: saved.createdAt,
    isCustomerRespondedLast: false,
  });
  await pConversationClientMessageInserted(subdomain, saved);
  return saved;
};
