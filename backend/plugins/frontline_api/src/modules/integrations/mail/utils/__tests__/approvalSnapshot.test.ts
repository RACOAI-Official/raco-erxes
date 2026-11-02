import type { IModels } from '~/connectionResolvers';
import { mailDraftSchema } from '@/integrations/mail/db/definitions/drafts';
import { loadMailDraftClass } from '@/integrations/mail/db/models/Drafts';

jest.mock('@/integrations/mail/db/definitions/drafts', () => ({
  mailDraftSchema: { loadClass: jest.fn() },
}));

test('changed email cannot claim delivery or call the mail transport', async () => {
  const findOneAndUpdate = jest.fn().mockResolvedValue(null);
  const createSendMail = jest.fn();
  loadMailDraftClass({
    MailDrafts: { findOneAndUpdate },
    MailMessages: { createSendMail },
  } as unknown as IModels);
  const Draft = jest.mocked(mailDraftSchema.loadClass).mock
    .calls[0][0] as unknown as {
    approveDraft: (
      id: string,
      tenant: string,
      snapshot: object,
    ) => Promise<unknown>;
  };
  const snapshot = {
    to: ['test@example.invalid'],
    subject: 'Reviewed subject',
    body: 'Reviewed body',
    inboxIntegrationId: 'inbox',
    inboxConversationId: 'conversation',
    updatedAt: new Date(),
  };
  await expect(Draft.approveDraft('draft', 'tenant', snapshot)).rejects.toThrow(
    'draft changed',
  );
  expect(findOneAndUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ _id: 'draft', ...snapshot }),
    expect.objectContaining({
      $set: expect.objectContaining({ status: 'sending' }),
    }),
    { new: true },
  );
  expect(createSendMail).not.toHaveBeenCalled();
});
