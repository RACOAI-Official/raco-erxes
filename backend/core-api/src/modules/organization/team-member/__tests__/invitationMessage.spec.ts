import type { IModels } from '~/connectionResolvers';
import { sendEmail } from '~/utils/email';
import { sendInvitationEmail } from '../utils';

jest.mock('~/utils/email', () => ({ sendEmail: jest.fn() }));
jest.mock('erxes-api-shared/utils', () => ({
  getEnv: () => 'https://crm.example.test',
}));

test('invitation uses the deployed confirmation URL and requires actual email delivery', async () => {
  const models = {} as IModels;
  await sendInvitationEmail(models, 'workspace', {
    email: 'member@example.test',
    token: 'fixture-token',
    userId: 'admin',
  });
  expect(sendEmail).toHaveBeenCalledWith(
    'workspace',
    expect.objectContaining({
      toEmails: ['member@example.test'],
      title: 'Team member invitation',
      template: {
        name: 'userInvitation',
        data: {
          content: 'https://crm.example.test/confirmation?token=fixture-token',
          domain: 'https://crm.example.test',
        },
      },
    }),
    models,
    { requireDelivery: true },
  );
});
