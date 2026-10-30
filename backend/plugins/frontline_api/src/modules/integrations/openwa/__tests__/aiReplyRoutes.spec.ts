import { createHmac } from 'node:crypto';
import type { Request, Response } from 'express';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { openwaRouter } from '../routes';
import { generateModels } from '~/connectionResolvers';
import { receiveOpenwaMessage } from '../service';
import { processWhatsAppEmailApproval } from '../emailApproval';
jest.mock('~/connectionResolvers', () => ({ generateModels: jest.fn() }));
jest.mock('../outbound', () => ({ composeOpenwaMessage: jest.fn() }));
jest.mock('../emailApproval', () => ({
  isEmailApprovalCommand: (text: string) =>
    /^\s*(APPROVE|REJECT)\b/i.test(text),
  processWhatsAppEmailApproval: jest.fn(),
}));
import { getOpenwaConfig } from '../contract';
import { getOpenwaAiConfig, receiveOpenwaAiReply } from '../aiReply';

jest.mock('../service', () => ({ receiveOpenwaMessage: jest.fn() }));
jest.mock('../aiReply', () => ({
  getOpenwaAiConfig: jest.fn(),
  receiveOpenwaAiReply: jest.fn(),
}));
jest.mock('../contract', () => ({
  ...jest.requireActual('../contract'),
  getOpenwaConfig: jest.fn(),
}));

const secret = 'private-test-signing-secret';
const originalEnabled = process.env.OPENWA_AI_ENABLED;
type RouteLayer = {
  route?: {
    path: string;
    stack: { handle: (req: Request, res: Response) => Promise<void> }[];
  };
};
const layers = (openwaRouter as unknown as { stack: RouteLayer[] }).stack;
const handler = layers
  .find((layer) => layer.route?.path === '/ai-reply')
  ?.route?.stack.at(-1)?.handle;

it('throttles webhook floods before authentication or model calls', async () => {
  process.env.OPENWA_AI_ENABLED = 'false';
  const app = express();
  app.use(openwaRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    for (let i = 0; i < 240; i++) {
      const response = await fetch(`http://127.0.0.1:${port}/ai-reply`, {
        method: 'POST',
      });
      await response.text();
      expect(response.status).toBe(503);
    }
    const limited = await fetch(`http://127.0.0.1:${port}/receive`, {
      method: 'POST',
    });
    await limited.text();
    expect(limited.status).toBe(429);
    expect(getOpenwaConfig).not.toHaveBeenCalled();
    expect(receiveOpenwaAiReply).not.toHaveBeenCalled();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

const request = () => {
  const body = {
    event: 'message.received',
    sessionId: 's1',
    timestamp: new Date().toISOString(),
    data: {
      id: 'm1',
      chatId: '123456789@c.us',
      from: '123456789@c.us',
      type: 'text',
      body: 'Hello',
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: false,
      isGroup: false,
    },
  };
  return body;
};

const run = async (body = request(), signed = true, tampered = false) => {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = signed
    ? `sha256=${createHmac('sha256', secret)
        .update(tampered ? 'different bytes' : rawBody)
        .digest('hex')}`
    : undefined;
  const req = { body, rawBody, get: () => signature } as unknown as Request;
  const res = { status: jest.fn(), json: jest.fn(), sendStatus: jest.fn() };
  res.status.mockReturnValue(res);
  if (!handler) throw new Error('Dedicated route was not registered');
  await handler(req, res as unknown as Response);
  return res;
};

beforeEach(() => {
  jest.resetAllMocks();
  process.env.OPENWA_AI_ENABLED = 'true';
  jest.mocked(getOpenwaConfig).mockReturnValue({
    baseUrl: 'http://openwa:2785',
    apiKey: 'private',
    sessionId: 's1',
    integrationId: 'i1',
    subdomain: 'tenant-a',
    secret,
  });
  jest
    .mocked(receiveOpenwaAiReply)
    .mockResolvedValue({ state: 'sent', messageId: 'm1' });
});

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.OPENWA_AI_ENABLED;
  else process.env.OPENWA_AI_ENABLED = originalEnabled;
});

test('is disabled unless explicitly enabled', async () => {
  delete process.env.OPENWA_AI_ENABLED;
  const res = await run();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(receiveOpenwaAiReply).not.toHaveBeenCalled();
});

test.each([
  [false, false],
  [true, true],
])('rejects unsigned or altered events', async (signed, tampered) => {
  const res = await run(request(), signed, tampered);
  expect(res.sendStatus).toHaveBeenCalledWith(401);
  expect(receiveOpenwaAiReply).not.toHaveBeenCalled();
});

test('rejects a different session even with a valid signature', async () => {
  const res = await run({ ...request(), sessionId: 'other-session' });
  expect(res.sendStatus).toHaveBeenCalledWith(403);
  expect(receiveOpenwaAiReply).not.toHaveBeenCalled();
});

test('accepts the signed direct-message event', async () => {
  const res = await run();
  expect(getOpenwaAiConfig).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    accepted: true,
    state: 'sent',
    messageId: 'm1',
  });
});

test('does not process unrelated events', async () => {
  const res = await run({ ...request(), event: 'session.ready' });
  expect(res.sendStatus).toHaveBeenCalledWith(204);
  expect(receiveOpenwaAiReply).not.toHaveBeenCalled();
});

test('signed approval bypasses LLM and automation dispatch', async () => {
  const body = request();
  body.data.body = 'APPROVE 0123456789ABCDEF01234567';
  jest.mocked(receiveOpenwaMessage).mockResolvedValue('approval-message');
  jest.mocked(generateModels).mockResolvedValue({
    Conversations: { findOne: jest.fn().mockResolvedValue(null) },
  } as never);
  jest.mocked(processWhatsAppEmailApproval).mockResolvedValue('approved');
  const res = await run(body);
  expect(receiveOpenwaMessage).toHaveBeenCalledWith(body.data, {
    emitAutomationTrigger: false,
  });
  expect(processWhatsAppEmailApproval).toHaveBeenCalledTimes(1);
  expect(receiveOpenwaAiReply).not.toHaveBeenCalled();
  expect(getOpenwaAiConfig).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({
    accepted: true,
    messageId: 'approval-message',
    emailApproval: 'approved',
  });
});

test('filtered approval never reaches the email send handler', async () => {
  const body = request();
  body.data.body = 'REJECT 0123456789ABCDEF01234567';
  body.data.fromMe = true;
  jest.mocked(receiveOpenwaMessage).mockResolvedValue(null);
  const res = await run(body);
  expect(processWhatsAppEmailApproval).not.toHaveBeenCalled();
  expect(receiveOpenwaAiReply).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ accepted: true, state: 'ignored' });
});
