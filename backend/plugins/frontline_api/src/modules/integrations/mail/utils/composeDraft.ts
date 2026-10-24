import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { IModels } from '~/connectionResolvers';
import { assertCustomerRecipient } from '@/integrations/mail/utils/mailRecipient';
import { publishMailDraftChanged } from '@/integrations/mail/utils/draftEvents';
import { conversationsChanged } from '@/inbox/meta/segments';
import { cleanHtml } from 'erxes-api-shared/utils';

export const composeDraftSchema = z.object({
  integrationId: z.string().min(1),
  customerId: z.string().optional(),
  to: z.string().email(),
  subject: z.string().trim().min(1).max(998),
  body: z.string().trim().min(1),
  requestId: z.string().min(1).max(200),
});

export const composeMailDraft = async (
  models: IModels, subdomain: string, input: z.input<typeof composeDraftSchema>,
) => {
  const args = composeDraftSchema.parse(input);
  const integration = await models.MailIntegrations.findByScope(args.integrationId);
  if (!integration?.inboxId || integration.disabledAt) throw new Error('Mail inbox is not connected');
  const inbox = await models.Integrations.findOne({ _id: integration.inboxId, kind: 'mail', isActive: { $ne: false } });
  if (!inbox) throw new Error('Mail inbox is inactive');
  const sourceMessageId = 'compose-' + createHash('sha256')
    .update(JSON.stringify([subdomain, integration.inboxId, args.requestId])).digest('hex');
  const previous = await models.MailDrafts.findOne({ sourceMessageId });
  if (previous) return previous;
  if (args.customerId) await assertCustomerRecipient(subdomain, args.customerId, args.to);
  const customerId = args.customerId || await models.MailCustomers.findOrCreate(subdomain, args.to.toLowerCase(), integration.inboxId);
  const conversationId = sourceMessageId;
  await models.Conversations.updateOne({ _id: conversationId }, { $setOnInsert: {
    integrationId: integration.inboxId, customerId, content: await cleanHtml(args.subject),
    status: 'new', createdAt: new Date(), updatedAt: new Date(),
  } }, { upsert: true });
  const draft = await models.MailDrafts.createDraft({
    inboxIntegrationId: integration.inboxId, inboxConversationId: conversationId,
    sourceMessageId, customerId, to: [args.to.toLowerCase()],
    subject: args.subject, body: args.body,
  });
  await publishMailDraftChanged(subdomain, draft);
  await conversationsChanged(subdomain, [conversationId]);
  return draft;
};
