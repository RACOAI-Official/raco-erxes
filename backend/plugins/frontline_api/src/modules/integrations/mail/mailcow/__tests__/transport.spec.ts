import { createMailcowTransport } from '../transport';
import { readMailcowConfig } from '../config';

const sendMail = jest.fn();
const close = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail, close })) }));
jest.mock('erxes-api-shared/utils', () => ({ getEnv: ({ name }: { name: string }) => process.env[name] || '' }));
jest.mock('@/integrations/mail/utils/attachments', () => ({ readAttachmentBytes: jest.fn() }));
jest.mock('@/integrations/mail/utils/transports/common', () => {
  class MailSendError extends Error {
    constructor(message: string, public retryable: boolean) { super(message); }
  }
  return { MailSendError, toPlainText: (value: string) => value, buildAutomationHeaders: () => undefined };
});

const config = { host: 'mail.example.com', port: 587, user: 'sales@example.com', password: 'private', address: 'sales@example.com' };
const input = { messageId: '<test@example.com>', from: config.address, replyTo: 'sales+tag@example.com', to: ['customer@example.net'], subject: 'Test', html: 'Hello' };

describe('Mailcow tenant scope and SMTP handoff', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('does not expose a configured mailbox to another tenant', () => {
    process.env.MAILCOW_SUBDOMAIN = 'one';
    expect(readMailcowConfig('two')).toBeNull();
    delete process.env.MAILCOW_SUBDOMAIN;
  });
  it('rejects another sender before SMTP', async () => {
    await expect(createMailcowTransport('one', config).send({ ...input, from: 'other@example.com' })).rejects.toThrow('sender must match');
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('records SMTP acceptance as queued and keeps thread identifiers', async () => {
    sendMail.mockResolvedValue({ messageId: input.messageId, accepted: input.to, rejected: [] });
    const result = await createMailcowTransport('one', config).send({ ...input, inReplyTo: '<previous>', references: ['<previous>'] });
    expect(result).toEqual({ providerMessageId: input.messageId, delivered: [], bounced: [], queued: input.to });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: config.address, messageId: input.messageId, inReplyTo: '<previous>' }));
    expect(close).toHaveBeenCalled();
  });
  it('treats permanent SMTP rejection as non-retryable without leaking server errors', async () => {
    sendMail.mockRejectedValue({ responseCode: 535, message: 'sensitive server detail' });
    await expect(createMailcowTransport('one', config).send(input)).rejects.toMatchObject({ retryable: false, message: expect.not.stringContaining('sensitive') });
    expect(close).toHaveBeenCalled();
  });
});
