import type { IModels } from '~/connectionResolvers';
import { deliverEmail } from 'erxes-api-shared/utils';
import { sendEmail } from '~/utils/email';

jest.mock('erxes-api-shared/utils', () => ({
  deliverEmail: jest.fn(),
  loadEmailProviderConfig: jest
    .fn()
    .mockResolvedValue({ DEFAULT_EMAIL_SERVICE: 'custom' }),
  alignSender: (from: string) => ({ from }),
  getEnv: ({ name }: { name: string }) =>
    name === 'NODE_ENV'
      ? 'production'
      : name === 'DOMAIN'
        ? 'https://crm.example.test'
        : 'os',
}));
jest.mock('@/organization/settings/utils/configs', () => ({
  getConfig: jest.fn().mockResolvedValue(''),
}));
jest.mock('~/utils/common', () => ({
  applyTemplate: jest.fn().mockResolvedValue('<p>Invitation</p>'),
}));
jest.mock('~/utils/email/ports', () => ({
  createDeliveryLogPort: jest.fn(),
  createSuppressionPort: jest.fn(),
}));
jest.mock('~/utils/email/senders', () => ({
  resolveAlignedFrom: jest.fn().mockResolvedValue('hello@example.test'),
}));

const models = {} as IModels;
const params = {
  toEmails: ['member@example.test'],
  title: 'Team member invitation',
  template: { name: 'userInvitation', data: {} },
};

beforeEach(() => {
  jest.mocked(deliverEmail).mockReset();
});

test('required email delivery accepts a confirmed recipient', async () => {
  jest
    .mocked(deliverEmail)
    .mockResolvedValue({
      provider: 'custom',
      messageId: 'fixture',
      accepted: ['member@example.test'],
      rejected: [],
    });
  await expect(
    sendEmail('workspace', params, models, { requireDelivery: true }),
  ).resolves.toBeUndefined();
});

test.each([
  {
    provider: 'custom' as const,
    messageId: '',
    accepted: [],
    rejected: [],
    skipped: true,
  },
  {
    provider: 'custom' as const,
    messageId: '',
    accepted: [],
    rejected: ['member@example.test'],
  },
])(
  'suppression or recipient rejection cannot appear successful',
  async (outcome) => {
    jest.mocked(deliverEmail).mockResolvedValue(outcome);
    await expect(
      sendEmail('workspace', params, models, { requireDelivery: true }),
    ).rejects.toThrow('Invitation email could not be delivered');
  },
);

test('SMTP failure is reported without exposing provider credentials to the client', async () => {
  jest
    .mocked(deliverEmail)
    .mockRejectedValue(new Error('fixture-private-provider-detail'));
  const failure = sendEmail('workspace', params, models, {
    requireDelivery: true,
  });
  await expect(failure).rejects.toThrow(
    'Invitation email could not be delivered',
  );
  await expect(failure).rejects.not.toThrow('fixture-private-provider-detail');
});

test('other existing best-effort transactional callers remain compatible', async () => {
  jest
    .mocked(deliverEmail)
    .mockRejectedValue(new Error('Transport unavailable'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await expect(
      sendEmail('workspace', params, models),
    ).resolves.toBeUndefined();
  } finally {
    log.mockRestore();
  }
});
