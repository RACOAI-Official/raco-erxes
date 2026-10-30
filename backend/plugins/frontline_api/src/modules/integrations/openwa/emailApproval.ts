import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { stripHtml } from 'string-strip-html';
import { redis, sendTRPCMessage } from 'erxes-api-shared/utils';
import type { IModels } from '~/connectionResolvers';
import type {
  IMailDraft,
  IMailDraftApprovalSnapshot,
} from '@/integrations/mail/@types/draft';
import { publishMailDraftChanged } from '@/integrations/mail/utils/draftEvents';
import { composeOpenwaMessage } from './outbound';
import {
  getOpenwaConfig,
  openwaId,
  openwaPhone,
  type OpenwaMessage,
} from './contract';

const TTL = 24 * 60 * 60;
const requestSchema = z.object({
  subdomain: z.string(),
  integrationId: z.string(),
  draftId: z.string(),
  contactId: z.string(),
  phone: z.string(),
  hash: z.string(),
  expiresAt: z.number(),
  ready: z.boolean(),
  state: z.enum([
    'pending',
    'processing',
    'approved',
    'rejected',
    'invalid',
    'needs_review',
  ]),
});
type ApprovalRequest = z.infer<typeof requestSchema>;
const phone = (value: string) => value.replace(/^\+/, '').replace(/^00/, '');
const keyFor = (subdomain: string, integrationId: string, code: string) =>
  openwaId('email-approval', subdomain, integrationId, code.toUpperCase());

export const isEmailApprovalCommand = (text: string) =>
  /^\s*(APPROVE|REJECT)\b/i.test(text);
export const parseEmailApprovalCommand = (text: string) => {
  const match = /^\s*(APPROVE|REJECT)\s+([A-F0-9]{24})\s*$/i.exec(text);
  return match
    ? { decision: match[1].toUpperCase(), code: match[2].toUpperCase() }
    : null;
};

export const approvalSnapshot = (
  draft: IMailDraft,
): IMailDraftApprovalSnapshot => ({
  to: [...draft.to],
  subject: draft.subject,
  body: draft.body,
  inboxIntegrationId: draft.inboxIntegrationId,
  inboxConversationId: draft.inboxConversationId,
  updatedAt: draft.updatedAt,
});
export const approvalHash = (draft: IMailDraft, sender: string) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        ...approvalSnapshot(draft),
        customerId: draft.customerId,
        replyToMessageId: draft.replyToMessageId,
        references: draft.references,
        shouldResolve: draft.shouldResolve,
        senderMismatch: draft.senderMismatch,
        sender,
      }),
    )
    .digest('hex');

const contactPhone = async (subdomain: string, contactId: string) => {
  const result: unknown = await sendTRPCMessage({
    subdomain,
    pluginName: 'core',
    module: 'customers',
    action: 'findOne',
    method: 'query',
    input: { query: { _id: contactId } },
  });
  const contact = z
    .object({ _id: z.string(), primaryPhone: z.string() })
    .parse(result);
  if (contact._id !== contactId) throw new Error('Approval contact mismatch');
  const digits = phone(contact.primaryPhone);
  if (!/^[1-9]\d{6,14}$/.test(digits))
    throw new Error('Approval contact needs an international phone number');
  return digits;
};

const senderAddress = async (models: IModels, draft: IMailDraft) => {
  const inbox = await models.MailIntegrations.findByScope(
    draft.inboxIntegrationId,
  );
  if (!inbox || inbox.disabledAt)
    throw new Error('Sending inbox is disconnected');
  return inbox.forwardFrom || inbox.address || '';
};

const chunks = (text: string) => {
  const result: string[] = [];
  let current = '';
  for (const character of text) {
    if (current.length + character.length > 3300) {
      result.push(current);
      current = '';
    }
    current += character;
  }
  if (current) result.push(current);
  return result;
};

/** Email is never sent here: the exact draft is presented before a code becomes valid. */
export const requestWhatsAppEmailApproval = async (
  subdomain: string,
  models: IModels,
  draftId: string,
  contactId: string,
  requestId: string,
) => {
  const config = getOpenwaConfig();
  if (config.subdomain !== subdomain)
    throw new Error('WhatsApp approval tenant mismatch');
  const draft = await models.MailDrafts.findOne({ _id: draftId });
  if (!draft || draft.status !== 'pending')
    throw new Error('Email is not awaiting approval');
  const [approverPhone, sender] = await Promise.all([
    contactPhone(subdomain, contactId),
    senderAddress(models, draft),
  ]);
  const hash = approvalHash(draft, sender);
  const mapping = openwaId(
    'email-approval-request',
    subdomain,
    config.integrationId,
    requestId,
  );
  const candidate = randomBytes(12).toString('hex').toUpperCase();
  await redis.set(mapping, candidate, 'EX', TTL, 'NX');
  const code = await redis.get(mapping);
  if (!code || !/^[A-F0-9]{24}$/.test(code))
    throw new Error('Approval request could not be saved');
  const key = keyFor(subdomain, config.integrationId, code);
  const existing = await redis.get(key);
  const request: ApprovalRequest = existing
    ? requestSchema.parse(JSON.parse(existing))
    : {
        subdomain,
        integrationId: config.integrationId,
        draftId,
        contactId,
        phone: approverPhone,
        hash,
        expiresAt: Date.now() + TTL * 1000,
        state: 'pending',
        ready: false,
      };
  if (
    request.hash !== hash ||
    request.phone !== approverPhone ||
    request.contactId !== contactId ||
    request.draftId !== draftId ||
    request.state !== 'pending' ||
    request.expiresAt <= Date.now()
  ) {
    throw new Error(
      'Approval request changed or expired; create a new request',
    );
  }
  const body = stripHtml(draft.body.replace(/<br\s*\/?>|<\/p>/gi, '\n'), {
    dumpLinkHrefsNearby: { enabled: true },
  }).result.trim();
  const preview = `EMAIL APPROVAL REQUIRED\nFrom: ${sender}\nTo: ${draft.to.join(', ')}\nSubject: ${draft.subject}\n${draft.senderMismatch ? 'WARNING: unverified original sender\n' : ''}\n--- EMAIL BODY ---\n${body}\n--- END EMAIL BODY ---`;
  if (preview.length > 24000)
    throw new Error(
      'Email is too long for WhatsApp review; review it in the CRM',
    );
  await redis.set(key, JSON.stringify(request), 'EX', TTL);
  const parts = chunks(preview);
  let message;
  for (let index = 0; index < parts.length; index++) {
    const instructions =
      index === parts.length - 1
        ? `\n\nReply APPROVE ${code} to send this exact email, or REJECT ${code} to keep it unsent. Expires in 24 hours. Editing the draft or changing the approval phone cancels this approval.`
        : '';
    message = await composeOpenwaMessage(
      subdomain,
      {
        customerId: contactId,
        text: `[${index + 1}/${parts.length}] ${parts[index]}${instructions}`,
        requestId: openwaId('email-approval-preview', requestId, String(index)),
      },
      { fromBot: true },
    );
  }
  request.ready = true;
  await redis.set(key, JSON.stringify(request), 'EX', TTL);
  if (!message) throw new Error('Approval preview was not sent');
  return message;
};

export type EmailApprovalState =
  | 'invalid'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'needs_review';
export const processWhatsAppEmailApproval = async (
  subdomain: string,
  models: IModels,
  message: OpenwaMessage,
): Promise<EmailApprovalState> => {
  const command = parseEmailApprovalCommand(message.body);
  if (
    !command ||
    message.fromMe ||
    message.isGroup ||
    message.isStatusBroadcast ||
    !['text', 'chat'].includes(message.type) ||
    /@(g\.us|broadcast|newsletter)$/.test(message.chatId) ||
    Date.now() - message.timestamp * 1000 > 300000 ||
    message.timestamp * 1000 > Date.now() + 60000
  )
    return 'invalid';
  const config = getOpenwaConfig();
  if (config.subdomain !== subdomain) return 'invalid';
  const key = keyFor(subdomain, config.integrationId, command.code);
  const lock = `${key}:lock`;
  const token = randomUUID();
  if ((await redis.set(lock, token, 'PX', 120000, 'NX')) !== 'OK')
    return 'processing';
  try {
    const raw = await redis.get(key);
    if (!raw) return 'invalid';
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return 'invalid';
    }
    const parsed = requestSchema.safeParse(value);
    if (!parsed.success) return 'invalid';
    const request = parsed.data;
    const actualPhone = phone(openwaPhone(message) || '');
    const chatPhone = /^(\d+)@(c\.us|s\.whatsapp\.net)$/.exec(
      message.chatId,
    )?.[1];
    if (
      request.subdomain !== subdomain ||
      request.integrationId !== config.integrationId ||
      request.expiresAt <= Date.now() ||
      !request.ready ||
      actualPhone !== request.phone ||
      (chatPhone && chatPhone !== actualPhone) ||
      (await contactPhone(subdomain, request.contactId)) !== request.phone
    )
      return 'invalid';
    if (request.state !== 'pending')
      return request.state === 'processing' ? 'needs_review' : request.state;
    const draft = await models.MailDrafts.findOne({ _id: request.draftId });
    if (
      !draft ||
      draft.status !== 'pending' ||
      approvalHash(draft, await senderAddress(models, draft)) !== request.hash
    ) {
      request.state = 'invalid';
    } else if (command.decision === 'REJECT') {
      request.state = 'rejected';
    } else {
      request.state = 'processing';
      await redis.set(key, JSON.stringify(request), 'EX', TTL);
      try {
        const result = await models.MailDrafts.approveDraft(
          request.draftId,
          subdomain,
          approvalSnapshot(draft),
        );
        request.state =
          result.message.deliveryStatus === 'sent'
            ? 'approved'
            : 'needs_review';
        await redis.set(key, JSON.stringify(request), 'EX', TTL);
        await publishMailDraftChanged(subdomain, result.draft);
        return request.state;
      } catch {
        request.state = 'needs_review';
      }
    }
    await redis.set(key, JSON.stringify(request), 'EX', TTL);
    return request.state;
  } finally {
    await redis.eval(
      "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1,
      lock,
      token,
    );
  }
};
