import { z } from 'zod';
import type {
  IMessage,
  IMessageDocument,
} from '@/inbox/@types/conversationMessages';
import { stripHtml } from 'string-strip-html';
import { randomUUID } from 'node:crypto';
import {
  redis,
  sendTRPCMessage,
  sendWorkerQueue,
} from 'erxes-api-shared/utils';
import { generateModels } from '~/connectionResolvers';
import { receiveInboxMessage } from '@/inbox/receiveMessage';
import { pConversationClientMessageInserted } from '@/inbox/graphql/resolvers/mutations/widget';
import {
  getOpenwaConfig,
  openwaHtml,
  openwaId,
  openwaPhone,
  type OpenwaMessage,
} from './contract';

const entity = z.object({ _id: z.string().min(1) });
const contact = entity.extend({
  firstName: z.string().nullish(),
  primaryPhone: z.string().nullish(),
});

/** Public Core contracts keep contact ownership and tenant isolation in Core. */
const syncCustomer = async (message: OpenwaMessage): Promise<string> => {
  const config = getOpenwaConfig();
  const phone = openwaPhone(message);
  const stableId = openwaId(
    'customer',
    config.subdomain,
    phone || `${config.sessionId}/${message.from}`,
  );
  const find = async (query: Record<string, unknown>) =>
    contact.safeParse(
      await sendTRPCMessage({
        subdomain: config.subdomain,
        pluginName: 'core',
        module: 'customers',
        action: 'findOne',
        method: 'query',
        input: { query },
      }),
    );
  let existing = await find({ _id: stableId });
  if (!existing.success && phone)
    existing = await find({ customerPrimaryPhone: phone });
  if (!existing.success && phone)
    existing = await find({ customerPrimaryPhone: phone.slice(1) });
  const name = message.contact?.name || message.contact?.pushName;
  if (existing.success) {
    // Fill missing contact fields; never overwrite names curated by CRM users.
    const doc = {
      ...(!existing.data.firstName && name ? { firstName: name } : {}),
      ...(!existing.data.primaryPhone && phone ? { primaryPhone: phone } : {}),
    };
    if (Object.keys(doc).length)
      await sendTRPCMessage({
        subdomain: config.subdomain,
        pluginName: 'core',
        module: 'customers',
        action: 'updateCustomer',
        method: 'mutation',
        input: { _id: existing.data._id, doc },
      });
    return existing.data._id;
  }
  try {
    const created: unknown = await sendTRPCMessage({
      subdomain: config.subdomain,
      pluginName: 'core',
      module: 'customers',
      action: 'createCustomer',
      method: 'mutation',
      input: {
        doc: {
          _id: stableId,
          firstName: name || phone || 'WhatsApp contact',
          ...(phone ? { primaryPhone: phone } : {}),
          integrationId: config.integrationId,
          state: 'customer',
        },
      },
    });
    return entity.parse(created)._id;
  } catch (error: unknown) {
    const recovered = await find({ _id: stableId });
    if (recovered.success) return recovered.data._id;
    throw error;
  }
};

/** Serializes a sender's deliveries, recovers inserts, and deduplicates trigger jobs. */
export const receiveOpenwaMessage = async (
  message: OpenwaMessage,
): Promise<string | null> => {
  if (
    message.fromMe ||
    message.isGroup ||
    message.isStatusBroadcast ||
    /@(g\.us|broadcast|newsletter)$/.test(message.chatId)
  )
    return null;
  const config = getOpenwaConfig();
  const models = await generateModels(config.subdomain);
  const integration = await models.Integrations.findOne({
    _id: config.integrationId,
    kind: 'openwa-messenger',
    isActive: { $ne: false },
  });
  if (!integration)
    throw new Error('OpenWA inbox integration is inactive or missing');
  const conversationId = openwaId('chat', config.integrationId, message.chatId);
  const messageId = openwaId('message', config.integrationId, message.id);
  const lock = `${config.subdomain}:${conversationId}:ingress`;
  const token = randomUUID();
  if ((await redis.set(lock, token, 'PX', 120000, 'NX')) !== 'OK')
    throw new Error('OpenWA chat is processing another delivery; retry');
  try {
    let stored: IMessageDocument | null =
      await models.ConversationMessages.findOne({
        _id: messageId,
        conversationId,
      });
    if (stored?.extraData?.openwaProcessed === true) return messageId;
    if (!stored) {
      const customerId = await syncCustomer(message);
      const text =
        message.body ||
        `[WhatsApp ${message.type} message — open WhatsApp to view this attachment]`;
      const content = openwaHtml(text);
      const conversation = await receiveInboxMessage(config.subdomain, {
        action: 'create-or-update-conversation',
        payload: JSON.stringify({
          conversationId,
          integrationId: integration._id,
          customerId,
          content,
          updatedAt: new Date(message.timestamp * 1000),
        }),
      });
      if (conversation.status !== 'success')
        throw new Error('Could not store WhatsApp conversation');
      const messageDoc: IMessage & { _id: string } = {
        _id: messageId,
        conversationId,
        customerId,
        content,
        contentType: 'text',
        createdAt: new Date(message.timestamp * 1000),
        extraData: {
          openwa: {
            messageId: message.id,
            chatId: message.chatId,
            type: message.type,
          },
        },
      };
      stored = await models.ConversationMessages.createMessage(messageDoc);
    }
    await models.Conversations.updateConversation(conversationId, {
      status: 'open',
      readUserIds: [],
      content: stored.content,
      updatedAt: stored.createdAt,
    });
    await pConversationClientMessageInserted(config.subdomain, stored);
    // Same public automation queue/envelope as sendAutomationTrigger, awaited
    // before acknowledging. Retained job IDs prevent retries starting a second run.
    await sendWorkerQueue('automations', 'trigger').add(
      'trigger',
      {
        subdomain: config.subdomain,
        data: {
          type: 'frontline:inbox.openwaMessages',
          targets: [
            {
              ...stored.toObject(),
              integrationId: integration._id,
              source: 'openwa',
              phone: openwaPhone(message),
            },
          ],
        },
      },
      { jobId: messageId, removeOnComplete: false, removeOnFail: false },
    );
    await models.ConversationMessages.updateOne(
      { _id: messageId },
      {
        $set: { 'extraData.openwaProcessed': true },
      },
    );
    return messageId;
  } finally {
    await redis.eval(
      "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1,
      lock,
      token,
    );
  }
};

const replySchema = z.object({
  integrationId: z.string(),
  conversationId: z.string(),
  content: z.string(),
  attachments: z.array(z.unknown()).optional(),
  poll: z.unknown().optional(),
});

/** Routes only replies to conversations owned by this pinned tenant/session. */
export const handleOpenwaIntegration = async ({
  subdomain,
  data,
}: {
  subdomain: string;
  data: {
    type: string;
    action: string;
    payload: string;
    integrationId: string;
  };
}): Promise<{
  status: 'success';
  data?: undefined;
  errorMessage?: undefined;
}> => {
  const config = getOpenwaConfig();
  if (
    subdomain !== config.subdomain ||
    data.integrationId !== config.integrationId ||
    data.type !== 'openwa' ||
    data.action !== 'reply-messenger'
  )
    throw new Error('Invalid OpenWA reply destination');
  const payload: unknown = JSON.parse(data.payload);
  const reply = replySchema.parse(payload);
  if (reply.integrationId !== config.integrationId)
    throw new Error('OpenWA integration mismatch');
  if (reply.attachments?.length || reply.poll)
    throw new Error(
      'OpenWA currently supports text replies. Send files or polls from WhatsApp.',
    );
  const text = stripHtml(
    reply.content.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n'),
  ).result.trim();
  if (!text || text.length > 4096)
    throw new Error('Enter a text reply of 1–4096 characters');
  const models = await generateModels(subdomain);
  const conversation = await models.Conversations.findOne({
    _id: reply.conversationId,
    integrationId: config.integrationId,
  });
  const integration = await models.Integrations.findOne({
    _id: config.integrationId,
    kind: 'openwa-messenger',
    isActive: { $ne: false },
  });
  if (!conversation || !integration)
    throw new Error('OpenWA conversation is unavailable');
  const incoming = await models.ConversationMessages.findOne({
    conversationId: conversation._id,
    'extraData.openwa.chatId': { $exists: true },
  }).sort({ createdAt: -1 });
  const destination = z
    .object({ chatId: z.string() })
    .parse(incoming?.extraData?.openwa);
  if (
    openwaId('chat', config.integrationId, destination.chatId) !==
    conversation._id
  )
    throw new Error('Invalid OpenWA chat mapping');
  const response = await fetch(
    `${config.baseUrl.replace(/\/$/, '')}/api/sessions/${encodeURIComponent(
      config.sessionId,
    )}/messages/send-text`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chatId: destination.chatId, text }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok)
    throw new Error(
      `OpenWA did not confirm delivery (HTTP ${response.status}); check WhatsApp before retrying`,
    );
  return { status: 'success' as const };
};
