import {
  generateOpenwaReply,
  getOpenwaAiConfig,
  receiveOpenwaAiReply,
} from '../aiReply';
import { getOpenwaConfig, openwaMessage } from '../contract';
import { receiveOpenwaMessage } from '../service';
import { composeOpenwaMessage } from '../outbound';
import { generateModels, type IModels } from '~/connectionResolvers';
import { redis } from 'erxes-api-shared/utils';

jest.mock('~/connectionResolvers', () => ({ generateModels: jest.fn() }));
jest.mock('erxes-api-shared/utils', () => ({
  redis: { get: jest.fn(), set: jest.fn() },
}));
jest.mock('../service', () => ({ receiveOpenwaMessage: jest.fn() }));
jest.mock('../outbound', () => ({ composeOpenwaMessage: jest.fn() }));
jest.mock('../contract', () => ({
  ...jest.requireActual('../contract'),
  getOpenwaConfig: jest.fn(),
}));

const originalFetch = global.fetch;
const envKeys = [
  'OPENWA_AI_ENABLED',
  'OPENWA_AI_LLM_BASE_URL',
  'OPENWA_AI_LLM_API_KEY',
  'OPENWA_AI_LLM_MODEL',
  'OPENWA_AI_MAX_TOKENS',
  'OPENWA_AI_INSTRUCTIONS',
];
const savedEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);
const fetchMock = jest.fn();
const updateOne = jest.fn(),
  findMessage = jest.fn(),
  findConversation = jest.fn();
const message = () =>
  openwaMessage.parse({
    id: 'incoming-1',
    chatId: '8801712345678@c.us',
    from: '8801712345678@c.us',
    body: 'What services do you offer?',
    type: 'text',
    timestamp: Math.floor(Date.now() / 1000),
    fromMe: false,
    isGroup: false,
  });
const completion = (text: string, finishReason = 'stop') => ({
  ok: true,
  json: async () => ({
    choices: [{ finish_reason: finishReason, message: { content: text } }],
  }),
});

beforeEach(() => {
  jest.resetAllMocks();
  process.env.OPENWA_AI_ENABLED = 'true';
  process.env.OPENWA_AI_LLM_BASE_URL = 'https://llm.example.test/v1';
  process.env.OPENWA_AI_LLM_API_KEY = 'private-test-key';
  process.env.OPENWA_AI_LLM_MODEL = 'qwen3';
  delete process.env.OPENWA_AI_MAX_TOKENS;
  delete process.env.OPENWA_AI_INSTRUCTIONS;
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue(
    completion('We build custom software. What do you need?'),
  );
  jest.mocked(getOpenwaConfig).mockReturnValue({
    baseUrl: 'http://openwa:2785',
    apiKey: 'test',
    sessionId: 's1',
    integrationId: 'i1',
    subdomain: 'tenant-a',
    secret: 'secret-at-least-16-chars',
  });
  jest.mocked(receiveOpenwaMessage).mockResolvedValue('stored-incoming');
  jest.mocked(redis.get).mockResolvedValue(null);
  jest.mocked(redis.set).mockResolvedValue('OK');
  updateOne.mockResolvedValue({ modifiedCount: 1 });
  findConversation.mockResolvedValue({ customerId: 'customer-1' });
  jest.mocked(generateModels).mockResolvedValue({
    ConversationMessages: { updateOne, findOne: findMessage },
    Conversations: { findOne: findConversation },
  } as unknown as IModels);
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  jest.restoreAllMocks();
});

test('uses a bounded plain-text Qwen request, both thinking controls and no redirects', async () => {
  await generateOpenwaReply('x'.repeat(3000));
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('https://llm.example.test/v1/chat/completions');
  expect(options.redirect).toBe('error');
  const body = JSON.parse(options.body);
  expect(body.max_tokens).toBe(512);
  expect(body.max_completion_tokens).toBeUndefined();
  expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  expect(body.messages[0].content).toContain('/no_think');
  expect(body.messages[1].content.length).toBeLessThan(2020);
  expect(body.tools).toBeUndefined();
});

test.each(['2001', '0', 'not-a-number'])(
  'rejects invalid token limit %s before a request',
  (value) => {
    process.env.OPENWA_AI_MAX_TOKENS = value;
    expect(getOpenwaAiConfig).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test('never forwards reasoning text to a customer', async () => {
  fetchMock.mockResolvedValue(
    completion('<think>private reasoning</think>Hello!'),
  );
  await expect(generateOpenwaReply('Hi')).resolves.toBe('Hello!');
});

test.each([
  ['', 'stop'],
  ['<think>unfinished', 'length'],
  ['Partial answer', 'length'],
])('rejects incomplete output %s', async (text, finish) => {
  fetchMock.mockResolvedValue(completion(text, finish));
  await expect(generateOpenwaReply('Hi')).rejects.toThrow(
    'LLM_NO_COMPLETE_REPLY',
  );
});

test('stores intake without the automation queue and sends once with a stable request ID', async () => {
  const result = await receiveOpenwaAiReply(message());
  expect(result.state).toBe('sent');
  expect(receiveOpenwaMessage).toHaveBeenCalledWith(expect.anything(), {
    emitAutomationTrigger: false,
  });
  expect(composeOpenwaMessage).toHaveBeenCalledTimes(1);
  expect(composeOpenwaMessage).toHaveBeenCalledWith(
    'tenant-a',
    {
      customerId: 'customer-1',
      text: 'We build custom software. What do you need?',
      requestId: expect.stringMatching(/^openwa-/),
    },
    { fromBot: true },
    { chatId: message().chatId, conversationId: expect.stringMatching(/^openwa-/) },
  );
});

test('a duplicate delivery does not generate or send another reply', async () => {
  updateOne.mockResolvedValue({ modifiedCount: 0 });
  findMessage.mockResolvedValue({
    extraData: { openwaAiReply: { state: 'sent' } },
  });
  await expect(receiveOpenwaAiReply(message())).resolves.toEqual({
    state: 'sent',
    messageId: 'stored-incoming',
  });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(composeOpenwaMessage).not.toHaveBeenCalled();
});

test('uncertain sends need review and are not blindly repeated', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest
    .mocked(composeOpenwaMessage)
    .mockRejectedValue(new Error('timeout with private provider body'));
  await expect(receiveOpenwaAiReply(message())).resolves.toMatchObject({
    state: 'needs_review',
  });
  expect(updateOne).toHaveBeenLastCalledWith(expect.anything(), {
    $set: {
      'extraData.openwaAiReply': {
        state: 'needs_review',
        reason: 'DELIVERY_UNCERTAIN',
        updatedAt: expect.any(Date),
      },
    },
  });
  expect(console.warn).not.toHaveBeenCalledWith(
    expect.stringContaining('private provider'),
  );
});

test('opt-out and handover requests pause the chat without contacting the LLM', async () => {
  await expect(
    receiveOpenwaAiReply({ ...message(), body: 'Please stop messaging me' }),
  ).resolves.toMatchObject({ state: 'paused' });
  expect(redis.set).toHaveBeenCalledWith(
    expect.stringMatching(/^openwa-/),
    '1',
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test('an already paused chat does not send', async () => {
  jest.mocked(redis.get).mockResolvedValue('1');
  await expect(receiveOpenwaAiReply(message())).resolves.toMatchObject({
    state: 'paused',
  });
  expect(composeOpenwaMessage).not.toHaveBeenCalled();
});

test('a question about AI agents is not treated as a human handover request', async () => {
  await expect(
    receiveOpenwaAiReply({ ...message(), body: 'Can you build an AI agent?' }),
  ).resolves.toMatchObject({ state: 'sent' });
  expect(redis.set).not.toHaveBeenCalled();
});

test('disabled service does not ingest or reply even when called directly', async () => {
  process.env.OPENWA_AI_ENABLED = 'false';
  await expect(receiveOpenwaAiReply(message())).resolves.toEqual({
    state: 'ignored',
  });
  expect(receiveOpenwaMessage).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('ignores own messages and groups before inbox intake', async () => {
  await receiveOpenwaAiReply({ ...message(), fromMe: true });
  await receiveOpenwaAiReply({ ...message(), isGroup: true });
  expect(receiveOpenwaMessage).not.toHaveBeenCalled();
});

test('old messages and media stay in the inbox without an AI reply', async () => {
  await receiveOpenwaAiReply({
    ...message(),
    timestamp: Math.floor(Date.now() / 1000) - 600,
  });
  await receiveOpenwaAiReply({ ...message(), type: 'image' });
  expect(receiveOpenwaMessage).toHaveBeenCalledTimes(2);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a pause arriving while the LLM runs prevents delivery', async () => {
  jest.mocked(redis.get).mockResolvedValueOnce(null).mockResolvedValueOnce('1');
  await expect(receiveOpenwaAiReply(message())).resolves.toMatchObject({
    state: 'needs_review',
  });
  expect(composeOpenwaMessage).not.toHaveBeenCalled();
});
