import { resolveOpenwaAutomationRecipient } from './openwaRecipient';

const findConversation = jest.fn();
const base = {
  configuredRecipient: '',
  resolvedRecipient: '',
  conversationId: undefined,
  customerId: 'email-customer',
  targetId: 'email-message',
  findConversation,
};
beforeEach(() => jest.clearAllMocks());

it('routes an email-triggered approval to the explicit approver', async () => {
  await expect(
    resolveOpenwaAutomationRecipient({
      ...base,
      configuredRecipient: '{{ input.approvalContactId }}',
      resolvedRecipient: 'approver',
      conversationId: 'email-conversation',
    }),
  ).resolves.toBe('approver');
  expect(findConversation).not.toHaveBeenCalled();
});
it.each(['', '{{ input.approvalContactId }}'])(
  'never falls back to the email customer when the approval binding is missing: %s',
  async (value) => {
    await expect(
      resolveOpenwaAutomationRecipient({
        ...base,
        configuredRecipient: '{{ input.approvalContactId }}',
        resolvedRecipient: value,
      }),
    ).rejects.toThrow('Choose the WhatsApp approval');
  },
);
it('preserves ordinary replies to a verified WhatsApp conversation', async () => {
  findConversation.mockResolvedValue({ customerId: 'whatsapp-customer' });
  await expect(
    resolveOpenwaAutomationRecipient({ ...base, conversationId: 'wa-thread' }),
  ).resolves.toBe('whatsapp-customer');
});
it('rejects an email thread when no explicit WhatsApp recipient was selected', async () => {
  findConversation.mockResolvedValue(null);
  await expect(
    resolveOpenwaAutomationRecipient({
      ...base,
      conversationId: 'email-thread',
    }),
  ).rejects.toThrow('configured WhatsApp inbox');
});
it('rejects a WhatsApp conversation without a contact', async () => {
  findConversation.mockResolvedValue({});
  await expect(
    resolveOpenwaAutomationRecipient({ ...base, conversationId: 'wa-thread' }),
  ).rejects.toThrow('no contact');
});
it('preserves contact-triggered compose', async () => {
  await expect(
    resolveOpenwaAutomationRecipient({
      ...base,
      customerId: undefined,
      targetId: 'selected-contact',
    }),
  ).resolves.toBe('selected-contact');
});
it('rejects an empty contact', async () => {
  await expect(
    resolveOpenwaAutomationRecipient({
      ...base,
      customerId: undefined,
      targetId: undefined,
    }),
  ).rejects.toThrow('Choose a CRM contact');
});
