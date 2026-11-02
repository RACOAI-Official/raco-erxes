import type { IContext } from '~/connectionResolvers';
import { userMutations } from '../graphql/mutations';
import { sendInvitationEmail } from '../utils';

jest.mock('../utils', () => ({ sendInvitationEmail: jest.fn() }));
jest.mock('erxes-api-shared/utils', () => ({
  getEnv: jest.fn(),
  getPlugins: jest.fn(),
  getPlugin: jest.fn(),
  graphqlPubsub: { publish: jest.fn() },
  authCookieOptions: jest.fn(),
}));
jest.mock('~/modules/auth/utils', () => ({ saveValidatedToken: jest.fn() }));
jest.mock('~/modules/notifications/utils', () => ({
  sendOnboardNotification: jest.fn(),
}));

const invite = jest.fn(),
  resendInvitation = jest.fn(),
  checkDuplication = jest.fn();
const checkPermission = jest.fn();
const context = {
  subdomain: 'workspace',
  user: { _id: 'admin' },
  checkPermission,
  models: { Users: { invite, resendInvitation, checkDuplication } },
} as unknown as IContext;

beforeEach(() => {
  jest.resetAllMocks();
  checkPermission.mockResolvedValue(true);
  checkDuplication.mockResolvedValue(undefined);
  invite.mockResolvedValue('fixture-invite-token');
  resendInvitation.mockResolvedValue('fixture-resend-token');
  jest.mocked(sendInvitationEmail).mockResolvedValue(undefined);
});

test('new invitation normalizes the address and reports success only after delivery', async () => {
  let finish: (() => void) | undefined;
  jest.mocked(sendInvitationEmail).mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  let completed = false;
  const pending = userMutations
    .usersInvite(
      undefined,
      { entries: [{ email: ' Member@Example.test ' }] },
      context,
    )
    .then((value) => {
      completed = true;
      return value;
    });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(sendInvitationEmail).toHaveBeenCalledWith(
    context.models,
    'workspace',
    {
      email: 'member@example.test',
      token: 'fixture-invite-token',
      userId: 'admin',
    },
  );
  expect(completed).toBe(false);
  finish?.();
  await expect(pending).resolves.toBe(true);
  expect(invite).toHaveBeenCalledWith({ email: 'member@example.test' });
});

test('failed invitation delivery rejects instead of returning false success', async () => {
  jest
    .mocked(sendInvitationEmail)
    .mockRejectedValue(new Error('Delivery failed'));
  await expect(
    userMutations.usersInvite(
      undefined,
      { entries: [{ email: 'member@example.test' }] },
      context,
    ),
  ).rejects.toThrow('Delivery failed');
});

test('resend actually emails the renewed token and keeps its existing return contract', async () => {
  await expect(
    userMutations.usersResendInvitation(
      undefined,
      { email: ' Member@Example.test ' },
      context,
    ),
  ).resolves.toBe('fixture-resend-token');
  expect(checkPermission).toHaveBeenCalledWith('teamMembersInvite');
  expect(resendInvitation).toHaveBeenCalledWith({
    email: 'member@example.test',
  });
  expect(sendInvitationEmail).toHaveBeenCalledWith(
    context.models,
    'workspace',
    {
      email: 'member@example.test',
      token: 'fixture-resend-token',
      userId: 'admin',
    },
  );
});

test('resend delivery failure rejects and does not report success', async () => {
  jest
    .mocked(sendInvitationEmail)
    .mockRejectedValue(new Error('Delivery failed'));
  await expect(
    userMutations.usersResendInvitation(
      undefined,
      { email: 'member@example.test' },
      context,
    ),
  ).rejects.toThrow('Delivery failed');
});

test('resend cannot mint or deliver a token without invitation permission', async () => {
  checkPermission.mockRejectedValue(new Error('Permission denied'));
  await expect(
    userMutations.usersResendInvitation(
      undefined,
      { email: 'member@example.test' },
      context,
    ),
  ).rejects.toThrow('Permission denied');
  expect(resendInvitation).not.toHaveBeenCalled();
  expect(sendInvitationEmail).not.toHaveBeenCalled();
});
