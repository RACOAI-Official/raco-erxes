import type { IModels } from '~/connectionResolvers';
import { redis, sendTRPCMessage } from 'erxes-api-shared/utils';
import { composeOpenwaMessage } from '../outbound';
import { getOpenwaConfig, openwaMessage } from '../contract';
import {
  isEmailApprovalCommand,
  parseEmailApprovalCommand,
  processWhatsAppEmailApproval,
  requestWhatsAppEmailApproval,
} from '../emailApproval';

jest.mock('erxes-api-shared/utils', () => ({
  redis: { set: jest.fn(), get: jest.fn(), eval: jest.fn() },
  sendTRPCMessage: jest.fn(),
}));
jest.mock('../outbound', () => ({ composeOpenwaMessage: jest.fn() }));
jest.mock('@/integrations/mail/utils/draftEvents', () => ({
  publishMailDraftChanged: jest.fn(),
}));
jest.mock('../contract', () => ({
  ...jest.requireActual('../contract'),
  getOpenwaConfig: jest.fn(),
}));

const store = new Map<string, string>();
const findDraft = jest.fn(),
  approveDraft = jest.fn(),
  findInbox = jest.fn();
const models = {
  MailDrafts: { findOne: findDraft, approveDraft },
  MailIntegrations: { findByScope: findInbox },
} as unknown as IModels;
const initial = () => ({
  _id: 'draft-a',
  inboxIntegrationId: 'mail-a',
  inboxConversationId: 'mail-thread-a',
  sourceMessageId: 'source-a',
  to: ['recipient@example.test'],
  subject: 'Review this email',
  body: '<p>Complete email content.</p>',
  status: 'pending',
  updatedAt: new Date('2026-10-30T00:00:00Z'),
  createdAt: new Date('2026-10-30T00:00:00Z'),
});
let draft = initial();
let approverPhone = '+8801771222836';
const input = (body: string) =>
  openwaMessage.parse({
    id: 'incoming-a',
    chatId: '8801771222836@c.us',
    from: '8801771222836@c.us',
    type: 'text',
    body,
    timestamp: Date.now() / 1000,
    fromMe: false,
    isGroup: false,
  });
const request = async () => {
  await requestWhatsAppEmailApproval(
    'tenant-a',
    models,
    'draft-a',
    'approver-a',
    'execution-a',
  );
  const calls = jest.mocked(composeOpenwaMessage).mock.calls;
  const code = /APPROVE ([A-F0-9]{24})/.exec(
    calls[calls.length - 1][1].text,
  )?.[1];
  if (!code) throw new Error('Missing approval code');
  return code;
};
const changeRequest = (patch: Record<string, unknown>) => {
  const entry = [...store].find(
    ([, value]) =>
      value.startsWith('{') && JSON.parse(value).draftId === 'draft-a',
  );
  if (!entry) throw new Error('No approval request');
  store.set(entry[0], JSON.stringify({ ...JSON.parse(entry[1]), ...patch }));
};

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  draft = initial();
  approverPhone = '+8801771222836';
  jest
    .mocked(getOpenwaConfig)
    .mockReturnValue({
      subdomain: 'tenant-a',
      integrationId: 'wa-a',
      sessionId: 'session-a',
      baseUrl: 'http://localhost',
      apiKey: 'private',
      secret: 'private-secret-value',
    });
  jest.mocked(redis.set).mockImplementation(async (...args: unknown[]) => {
    const [key, value] = args;
    if (args.includes('NX') && store.has(String(key))) return null;
    store.set(String(key), String(value));
    return 'OK';
  });
  jest
    .mocked(redis.get)
    .mockImplementation(async (key) => store.get(String(key)) ?? null);
  jest.mocked(redis.eval).mockImplementation(async (_script, _count, key) => {
    store.delete(String(key));
    return 1;
  });
  jest
    .mocked(sendTRPCMessage)
    .mockImplementation(async () => ({
      _id: 'approver-a',
      primaryPhone: approverPhone,
    }));
  findDraft.mockImplementation(async () => draft);
  findInbox.mockResolvedValue({ address: 'hello@example.test' });
  approveDraft.mockResolvedValue({
    draft: { ...initial(), status: 'sent' },
    message: { deliveryStatus: 'sent' },
  });
  jest
    .mocked(composeOpenwaMessage)
    .mockImplementation(
      async (_tenant, message) =>
        ({
          _id: 'wa-notice',
          conversationId: 'wa-thread',
          content: message.text,
        }) as never,
    );
});

test('preview includes recipients, subject and full body but does not send email', async () => {
  await request();
  expect(approveDraft).not.toHaveBeenCalled();
  const text = jest.mocked(composeOpenwaMessage).mock.calls[0][1].text;
  expect(text).toContain('recipient@example.test');
  expect(text).toContain('Review this email');
  expect(text).toContain('Complete email content.');
  expect(text).toContain('REJECT ');
});
test('retry keeps the same approval code and provider idempotency key', async () => {
  const first = await request();
  const call = jest.mocked(composeOpenwaMessage).mock.calls[0][1];
  expect(await request()).toBe(first);
  expect(jest.mocked(composeOpenwaMessage).mock.calls[1][1]).toEqual(call);
});
test('only an exact approval from the assigned phone sends once with a snapshot guard', async () => {
  const code = await request();
  await expect(
    processWhatsAppEmailApproval('tenant-a', models, input(`APPROVE ${code}`)),
  ).resolves.toBe('approved');
  await expect(
    processWhatsAppEmailApproval('tenant-a', models, input(`APPROVE ${code}`)),
  ).resolves.toBe('approved');
  expect(approveDraft).toHaveBeenCalledTimes(1);
  expect(approveDraft).toHaveBeenCalledWith(
    'draft-a',
    'tenant-a',
    expect.objectContaining({
      to: ['recipient@example.test'],
      body: draft.body,
      updatedAt: draft.updatedAt,
    }),
  );
});
test('REJECT keeps the email unsent, including a later APPROVE with the same code', async () => {
  const code = await request();
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`REJECT ${code}`),
    ),
  ).toBe('rejected');
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${code}`),
    ),
  ).toBe('rejected');
  expect(approveDraft).not.toHaveBeenCalled();
});
test('wrong sender cannot approve a valid code', async () => {
  const code = await request();
  const message = {
    ...input(`APPROVE ${code}`),
    from: '447700900123@c.us',
    chatId: '447700900123@c.us',
  };
  expect(await processWhatsAppEmailApproval('tenant-a', models, message)).toBe(
    'invalid',
  );
  expect(approveDraft).not.toHaveBeenCalled();
});
test('numeric chat identity must match the reported sender phone', async () => {
  const code = await request();
  const message = { ...input(`APPROVE ${code}`), chatId: '447700900123@c.us' };
  expect(await processWhatsAppEmailApproval('tenant-a', models, message)).toBe(
    'invalid',
  );
  expect(approveDraft).not.toHaveBeenCalled();
});
test('changing the configured approval phone invalidates pending approvals', async () => {
  const code = await request();
  approverPhone = '+447700900123';
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${code}`),
    ),
  ).toBe('invalid');
  expect(approveDraft).not.toHaveBeenCalled();
});
test.each(['body', 'subject', 'to'] as const)(
  'editing draft %s invalidates approval',
  async (field) => {
    const code = await request();
    if (field === 'to') draft.to = ['changed@example.test'];
    else draft[field] = 'Edited';
    expect(
      await processWhatsAppEmailApproval(
        'tenant-a',
        models,
        input(`APPROVE ${code}`),
      ),
    ).toBe('invalid');
    expect(approveDraft).not.toHaveBeenCalled();
  },
);
test('changing sending address invalidates approval', async () => {
  const code = await request();
  findInbox.mockResolvedValue({ address: 'different@example.test' });
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${code}`),
    ),
  ).toBe('invalid');
  expect(approveDraft).not.toHaveBeenCalled();
});
test.each([
  { expiresAt: 0 },
  { ready: false },
  { subdomain: 'other-tenant' },
  { integrationId: 'other-inbox' },
])('rejects stale, incomplete and foreign requests: %j', async (patch) => {
  const code = await request();
  changeRequest(patch);
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${code}`),
    ),
  ).toBe('invalid');
  expect(approveDraft).not.toHaveBeenCalled();
});
test('uncertain email delivery requires manual review and never retries automatically', async () => {
  const code = await request();
  approveDraft.mockRejectedValue(new Error('Transport interrupted'));
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${code}`),
    ),
  ).toBe('needs_review');
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${code}`),
    ),
  ).toBe('needs_review');
  expect(approveDraft).toHaveBeenCalledTimes(1);
});
test('a failed email delivery is not reported as sent', async () => {
  const code = await request();
  approveDraft.mockResolvedValue({
    draft,
    message: { deliveryStatus: 'failed' },
  });
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${code}`),
    ),
  ).toBe('needs_review');
});
test('an interrupted processing claim never retries sending', async () => {
  const code = await request();
  changeRequest({ state: 'processing' });
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${code}`),
    ),
  ).toBe('needs_review');
  expect(approveDraft).not.toHaveBeenCalled();
});
test('approval is unavailable until every preview part is accepted', async () => {
  draft.body = 'Complete text '.repeat(400);
  jest
    .mocked(composeOpenwaMessage)
    .mockRejectedValue(new Error('Provider unavailable'));
  await expect(request()).rejects.toThrow('Provider unavailable');
  const mappingCode = [...store.values()].find((v) => /^[A-F0-9]{24}$/.test(v));
  expect(
    await processWhatsAppEmailApproval(
      'tenant-a',
      models,
      input(`APPROVE ${mappingCode}`),
    ),
  ).toBe('invalid');
  expect(approveDraft).not.toHaveBeenCalled();
});
test.each([
  'APPROVE',
  'approve unknown',
  'please approve',
  'APPROVE 0123456789ABCDEF01234567 extra',
])('does not infer approval from ambiguous text: %s', async (body) => {
  expect(parseEmailApprovalCommand(body)).toBeNull();
  expect(
    await processWhatsAppEmailApproval('tenant-a', models, input(body)),
  ).toBe('invalid');
  expect(approveDraft).not.toHaveBeenCalled();
});
test('commands are distinguished from ordinary customer text', () => {
  expect(isEmailApprovalCommand('APPROVE')).toBe(true);
  expect(isEmailApprovalCommand('Can you approve this?')).toBe(false);
});
test.each([
  { isGroup: true },
  { fromMe: true },
  { isStatusBroadcast: true },
  { timestamp: 1 },
])('rejects non-direct or ancient approval: %j', async (patch) => {
  const code = await request();
  expect(
    await processWhatsAppEmailApproval('tenant-a', models, {
      ...input(`APPROVE ${code}`),
      ...patch,
    }),
  ).toBe('invalid');
  expect(approveDraft).not.toHaveBeenCalled();
});
