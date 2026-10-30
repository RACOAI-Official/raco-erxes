type RecipientInput = {
  configuredRecipient: unknown;
  resolvedRecipient: unknown;
  conversationId: unknown;
  customerId: unknown;
  targetId: unknown;
  findConversation: (id: string) => Promise<{ customerId?: string } | null>;
};

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

/** Explicit contacts support approval notifications from non-WhatsApp triggers. */
export const resolveOpenwaAutomationRecipient = async (
  input: RecipientInput,
) => {
  const configured = text(input.configuredRecipient);
  const resolved = text(input.resolvedRecipient);
  if (configured) {
    if (!resolved || /\{\{|\}\}/.test(resolved)) {
      throw new Error('Choose the WhatsApp approval or recipient contact');
    }
    return resolved;
  }

  const conversationId = text(input.conversationId);
  if (conversationId) {
    const conversation = await input.findConversation(conversationId);
    if (!conversation) {
      throw new Error(
        'Trigger is not a conversation in the configured WhatsApp inbox',
      );
    }
    const customerId = text(conversation.customerId);
    if (!customerId) throw new Error('WhatsApp conversation has no contact');
    return customerId;
  }

  const customerId = text(input.customerId) || text(input.targetId);
  if (!customerId)
    throw new Error('Choose a CRM contact for the WhatsApp message');
  return customerId;
};
