import { composeOpenwaMessage } from '../outbound';
import { getOpenwaConfig, openwaHtml } from '../contract';
import { generateModels, type IModels } from '~/connectionResolvers';
import { sendTRPCMessage } from 'erxes-api-shared/utils';
import { pConversationClientMessageInserted } from '@/inbox/graphql/resolvers/mutations/widget';

jest.mock('~/connectionResolvers', () => ({ generateModels: jest.fn() }));
jest.mock('erxes-api-shared/utils', () => ({ sendTRPCMessage: jest.fn() }));
jest.mock('@/inbox/graphql/resolvers/mutations/widget', () => ({ pConversationClientMessageInserted: jest.fn() }));
jest.mock('../contract', () => ({ ...jest.requireActual('../contract'), getOpenwaConfig: jest.fn() }));

const config = { subdomain: 'tenant-a', integrationId: 'i1', sessionId: 's1', baseUrl: 'http://localhost:2785', apiKey: 'hidden', secret: 'secret-of-at-least-16-chars' };
const findMessage = jest.fn(), createMessage = jest.fn(), exists = jest.fn(), createConversation = jest.fn(), updateConversation = jest.fn();
const models = { Integrations: { findOne: jest.fn().mockResolvedValue({ _id: 'i1' }) },
  Conversations: { exists, createConversation, updateConversation }, ConversationMessages: { findOne: findMessage, createMessage } } as unknown as IModels;
const originalFetch = global.fetch;
const input = { customerId: 'c1', text: 'Hello <Rahman>', requestId: 'test-request-1234' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getOpenwaConfig).mockReturnValue(config);
  jest.mocked(generateModels).mockResolvedValue(models);
  jest.mocked(sendTRPCMessage).mockResolvedValue({ _id: 'c1', primaryPhone: '+8801771222836' });
  findMessage.mockResolvedValue(null); exists.mockResolvedValue(null);
  createMessage.mockImplementation(async (doc: Record<string, unknown>) => ({ ...doc, createdAt: new Date() }));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messageId: 'provider-m1' }) });
});
afterEach(() => { global.fetch = originalFetch; });

test('composes through OpenWA using the saved contact phone and an idempotency header, then records CRM history', async () => {
  const result = await composeOpenwaMessage('tenant-a', input, { userId: 'u1' });
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:2785/api/sessions/s1/messages/send-text', expect.objectContaining({
    headers: expect.objectContaining({ 'Idempotency-Key': result._id }),
    body: JSON.stringify({ chatId: '8801771222836@c.us', text: input.text }),
  }));
  expect(createMessage).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', content: openwaHtml(input.text), deliveryStatus: 'sent' }));
  expect(pConversationClientMessageInserted).toHaveBeenCalled();
});

test('a repeated completed request returns history without sending another WhatsApp message', async () => {
  const first = await composeOpenwaMessage('tenant-a', input, { userId: 'u1' });
  findMessage.mockResolvedValue(first);
  await composeOpenwaMessage('tenant-a', input, { userId: 'u1' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await expect(composeOpenwaMessage('tenant-a', { ...input, text: 'Different' }, { userId: 'u1' })).rejects.toThrow('different message');
});

test('provider failures do not write a message that looks sent', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  await expect(composeOpenwaMessage('tenant-a', input, { fromBot: true })).rejects.toThrow('same request ID');
  expect(createMessage).not.toHaveBeenCalled();
});

test('another tenant or a missing contact phone cannot reach WhatsApp', async () => {
  await expect(composeOpenwaMessage('tenant-b', input, {})).rejects.toThrow('tenant mismatch');
  jest.mocked(sendTRPCMessage).mockResolvedValue({ _id: 'c1', primaryPhone: 'invalid' });
  await expect(composeOpenwaMessage('tenant-a', input, {})).rejects.toThrow('international');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('a malformed provider success cannot create a false sent record', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  await expect(composeOpenwaMessage('tenant-a', input, {})).rejects.toThrow();
  expect(createMessage).not.toHaveBeenCalled();
});
