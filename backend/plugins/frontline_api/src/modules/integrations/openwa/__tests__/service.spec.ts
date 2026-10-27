import { receiveOpenwaMessage, handleOpenwaIntegration } from '../service';
import { getOpenwaConfig, openwaId, openwaMessage } from '../contract';
import { generateModels, type IModels } from '~/connectionResolvers';
import {
  redis,
  sendTRPCMessage,
  sendWorkerQueue,
} from 'erxes-api-shared/utils';
import { receiveInboxMessage } from '@/inbox/receiveMessage';
import { pConversationClientMessageInserted } from '@/inbox/graphql/resolvers/mutations/widget';

jest.mock('~/connectionResolvers', () => ({ generateModels: jest.fn() }));
jest.mock('erxes-api-shared/utils', () => ({
  redis: { set: jest.fn(), eval: jest.fn() },
  sendTRPCMessage: jest.fn(),
  sendWorkerQueue: jest.fn(),
}));
jest.mock('@/inbox/receiveMessage', () => ({ receiveInboxMessage: jest.fn() }));
jest.mock('@/inbox/graphql/resolvers/mutations/widget', () => ({
  pConversationClientMessageInserted: jest.fn(),
}));
jest.mock('../contract', () => ({
  ...jest.requireActual('../contract'),
  getOpenwaConfig: jest.fn(),
}));

const config = {
  baseUrl: 'http://localhost:2785',
  apiKey: 'hidden',
  sessionId: 's1',
  integrationId: 'i1',
  subdomain: 'tenant-a',
  secret: 'secret-of-at-least-16-chars',
};
const input = openwaMessage.parse({
  id: 'm1',
  from: '8801712345678@c.us',
  chatId: '8801712345678@c.us',
  body: 'Hello',
  type: 'text',
  timestamp: 1700000000,
  fromMe: false,
  isGroup: false,
});
const findMessage = jest.fn(),
  createMessage = jest.fn(),
  queueAdd = jest.fn();
const updateMessage = jest.fn(),
  updateConversation = jest.fn();
const findConversation = jest.fn(),
  findIntegration = jest.fn();
const models = {
  Integrations: { findOne: findIntegration },
  Conversations: { findOne: findConversation, updateConversation },
  ConversationMessages: {
    findOne: findMessage,
    createMessage,
    updateOne: updateMessage,
  },
} as unknown as IModels;
const originalFetch = global.fetch;

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getOpenwaConfig).mockReturnValue(config);
  jest.mocked(generateModels).mockResolvedValue(models);
  jest.mocked(redis.set).mockResolvedValue('OK');
  findIntegration.mockResolvedValue({ _id: 'i1' });
  findMessage.mockResolvedValue(null);
  jest
    .mocked(sendTRPCMessage)
    .mockResolvedValue({
      _id: 'customer-1',
      firstName: 'Existing',
      primaryPhone: '+8801712345678',
    });
  jest
    .mocked(receiveInboxMessage)
    .mockResolvedValue({ status: 'success', data: { _id: 'conversation' } });
  createMessage.mockImplementation(async (doc: Record<string, unknown>) => ({
    ...doc,
    toObject: () => doc,
  }));
  jest
    .mocked(sendWorkerQueue)
    .mockReturnValue({ add: queueAdd } as unknown as ReturnType<
      typeof sendWorkerQueue
    >);
});
afterEach(() => {
  global.fetch = originalFetch;
});

test.each([
  { ...input, fromMe: true },
  { ...input, isGroup: true },
  { ...input, chatId: 'status@broadcast' },
])('ignores own messages, groups and broadcasts', async (message) => {
  expect(await receiveOpenwaMessage(message)).toBeNull();
  expect(generateModels).not.toHaveBeenCalled();
});

test('stores a direct message in the correct integration and emits a dedicated deduplicated trigger', async () => {
  const id = await receiveOpenwaMessage(input);
  expect(createMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      _id: id,
      customerId: 'customer-1',
      content: 'Hello',
    }),
  );
  expect(receiveInboxMessage).toHaveBeenCalledWith(
    'tenant-a',
    expect.objectContaining({ action: 'create-or-update-conversation' }),
  );
  expect(pConversationClientMessageInserted).toHaveBeenCalledTimes(1);
  expect(queueAdd).toHaveBeenCalledWith(
    'trigger',
    expect.objectContaining({
      subdomain: 'tenant-a',
      data: expect.objectContaining({ type: 'frontline:inbox.openwaMessages' }),
    }),
    expect.objectContaining({ jobId: id, removeOnComplete: false }),
  );
  expect(updateMessage).toHaveBeenCalledWith(
    { _id: id },
    { $set: { 'extraData.openwaProcessed': true } },
  );
  expect(redis.eval).toHaveBeenCalled();
});

test('redelivery after completion does not create a contact, message or trigger', async () => {
  findMessage.mockResolvedValue({ extraData: { openwaProcessed: true } });
  await receiveOpenwaMessage(input);
  expect(createMessage).not.toHaveBeenCalled();
  expect(sendTRPCMessage).not.toHaveBeenCalled();
  expect(queueAdd).not.toHaveBeenCalled();
});

test('queue failure leaves the message recoverable and releases the lease', async () => {
  queueAdd.mockRejectedValue(new Error('Queue unavailable'));
  await expect(receiveOpenwaMessage(input)).rejects.toThrow(
    'Queue unavailable',
  );
  expect(updateMessage).not.toHaveBeenCalled();
  expect(redis.eval).toHaveBeenCalled();
});

test('active leases cause a retry and inactive integrations never create contacts', async () => {
  jest.mocked(redis.set).mockResolvedValueOnce(null);
  await expect(receiveOpenwaMessage(input)).rejects.toThrow('retry');
  expect(createMessage).not.toHaveBeenCalled();
  findIntegration.mockResolvedValueOnce(null);
  await expect(receiveOpenwaMessage(input)).rejects.toThrow('inactive');
  expect(sendTRPCMessage).not.toHaveBeenCalled();
});

const replyData = (conversationId = openwaId('chat', 'i1', input.chatId)) => ({
  type: 'openwa',
  action: 'reply-messenger',
  integrationId: 'i1',
  payload: JSON.stringify({
    integrationId: 'i1',
    conversationId,
    content: '<p>Hello<br>there</p>',
    attachments: [],
  }),
});

test('replies only through the stored tenant/session/chat mapping', async () => {
  const conversationId = openwaId('chat', 'i1', input.chatId);
  findConversation.mockResolvedValue({ _id: conversationId });
  findMessage.mockReturnValue({
    sort: jest
      .fn()
      .mockResolvedValue({ extraData: { openwa: { chatId: input.chatId } } }),
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  await handleOpenwaIntegration({ subdomain: 'tenant-a', data: replyData() });
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:2785/api/sessions/s1/messages/send-text',
    expect.objectContaining({
      body: JSON.stringify({ chatId: input.chatId, text: 'Hello\nthere' }),
    }),
  );
  await expect(
    handleOpenwaIntegration({ subdomain: 'tenant-b', data: replyData() }),
  ).rejects.toThrow('destination');
});

test('a forged mapping cannot send a reply to a different WhatsApp chat', async () => {
  findConversation.mockResolvedValue({ _id: 'forged' });
  findMessage.mockReturnValue({
    sort: jest
      .fn()
      .mockResolvedValue({ extraData: { openwa: { chatId: input.chatId } } }),
  });
  global.fetch = jest.fn();
  await expect(
    handleOpenwaIntegration({
      subdomain: 'tenant-a',
      data: replyData('forged'),
    }),
  ).rejects.toThrow('mapping');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('rejects a reply above the OpenWA send-text limit', async () => {
  global.fetch = jest.fn();
  const data = {
    ...replyData(),
    payload: JSON.stringify({
      integrationId: 'i1',
      conversationId: openwaId('chat', 'i1', input.chatId),
      content: 'x'.repeat(4097),
    }),
  };
  await expect(handleOpenwaIntegration({ subdomain: 'tenant-a', data })).rejects.toThrow('4096');
  expect(global.fetch).not.toHaveBeenCalled();
});
