import type { IContext } from '~/connectionResolvers';
import { authorizeConversationAccess } from './conversationAccess';

export const authorizeConversationAction = async (
  context: IContext,
  action: string,
  conversationIds: string[],
): Promise<void> => {
  await context.checkPermission(action);
  if (!conversationIds.length) {
    throw new Error('At least one conversation is required');
  }
  for (const id of new Set(conversationIds)) {
    await authorizeConversationAccess(
      context.models,
      context.user,
      id,
      context.subdomain,
    );
  }
};
