import { composeMailDraft } from '../composeDraft';
import type { IModels } from '~/connectionResolvers';
jest.mock('@/integrations/mail/utils/mailRecipient', () => ({ assertCustomerRecipient: jest.fn() }));
jest.mock('@/integrations/mail/utils/draftEvents', () => ({ publishMailDraftChanged: jest.fn() }));
jest.mock('@/inbox/meta/segments', () => ({ conversationsChanged: jest.fn() }));
jest.mock('erxes-api-shared/utils', () => ({ cleanHtml: async (value: string) => value }));

const args = { integrationId: 'inbox', to: 'recipient@example.com', subject: 'Review', body: '<p>Draft only</p>', requestId: 'request-1' };
const setup = () => {
  const models = {
    MailIntegrations: { findByScope: jest.fn().mockResolvedValue({ inboxId: 'inbox' }) },
    Integrations: { findOne: jest.fn().mockResolvedValue({ _id: 'inbox' }) },
    MailDrafts: { findOne: jest.fn().mockResolvedValue(null), createDraft: jest.fn().mockImplementation(async (draft: object) => ({ _id: 'draft', ...draft })) },
    MailCustomers: { findOrCreate: jest.fn().mockResolvedValue('customer') },
    Conversations: { updateOne: jest.fn().mockResolvedValue({}) },
    MailMessages: { createSendMail: jest.fn() },
  };
  return models;
};
describe('Human review email composition', () => {
  it('creates a draft and conversation without invoking delivery', async () => {
    const models = setup();
    const result = await composeMailDraft(models as unknown as IModels, 'tenant', args);
    expect(result.to).toEqual([args.to]);
    expect(models.MailDrafts.createDraft).toHaveBeenCalledWith(expect.objectContaining({ subject: args.subject, body: args.body }));
    expect(models.MailMessages.createSendMail).not.toHaveBeenCalled();
  });
  it('returns a previous draft on retry without another conversation', async () => {
    const models = setup();
    models.MailDrafts.findOne.mockResolvedValue({ _id: 'existing' });
    expect(await composeMailDraft(models as unknown as IModels, 'tenant', args)).toEqual({ _id: 'existing' });
    expect(models.Conversations.updateOne).not.toHaveBeenCalled();
  });
  it('rejects invalid recipients before creating a draft', async () => {
    const models = setup();
    await expect(composeMailDraft(models as unknown as IModels, 'tenant', { ...args, to: 'bad' })).rejects.toThrow();
    expect(models.MailDrafts.createDraft).not.toHaveBeenCalled();
  });
});
