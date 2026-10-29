import type { IContext } from '~/connectionResolvers';
import { conversationQueries } from '@/inbox/graphql/resolvers/queries/conversations';
import { conversationMutations } from '@/inbox/graphql/resolvers/mutations/conversations';

jest.mock('erxes-api-shared/utils', () => ({
  markResolvers: jest.fn(), graphqlPubsub: { publish: jest.fn() },
}));
jest.mock('@/channel/utils', () => ({ visibleChannelsFilter: jest.fn().mockResolvedValue({}) }));
jest.mock('@/inbox/graphql/resolvers/queries/inboxFields', () => ({ inboxFieldQueries: {} }));
jest.mock('@/inbox/utils/conversationCounts', () => ({}));
jest.mock('@/inbox/services/conversationConvert', () => ({}));
jest.mock('@/inbox/services/conversationConvertTargets', () => ({}));
jest.mock('~/conversationQueryBuilder', () => ({}));
jest.mock('@/inbox/graphql/resolvers/queries/conversationMessages', () => ({ conversationMessageQueries: {} }));
jest.mock('~/utils/notifications', () => ({ createNotifications: jest.fn() }));
jest.mock('@/inbox/graphql/resolvers/mutations/conversationAutomation', () => ({}));
jest.mock('@/integrations/facebook/services/automatedReplyControl', () => ({}));
jest.mock('@/inbox/graphql/resolvers/mutations/conversationNotifications', () => ({
  publishConversationsChanged: jest.fn(), sendNotifications: jest.fn(),
}));
jest.mock('@/inbox/graphql/resolvers/mutations/conversationMessageMutations', () => ({ conversationMessageMutations: {} }));

describe('staff resolver access before reads and writes', () => {
  const findOne = jest.fn();
  const assignUserConversation = jest.fn();
  const exists = jest.fn();
  const checkPermission = jest.fn();
  const context = {
    user: { _id: 'agent' }, subdomain: 'test', checkPermission,
    models: {
      Conversations: {
        findOne, assignUserConversation,
        getConversation: jest.fn().mockResolvedValue({ integrationId: 'mail' }),
      },
      Integrations: { findOne: () => ({ lean: async () => ({ channelId: 'channel' }) }) },
      Channels: { exists },
    },
  } as unknown as IContext;

  beforeEach(() => {
    jest.clearAllMocks();
    checkPermission.mockResolvedValue(undefined);
    exists.mockResolvedValue(true);
  });

  it('does not return detail from another private inbox', async () => {
    exists.mockResolvedValue(false);
    await expect(conversationQueries.conversationDetail(undefined, { _id: 'private' }, context))
      .rejects.toThrow('permission to access');
    expect(findOne).not.toHaveBeenCalled();
  });

  it('returns detail for a visible inbox after checking read permission', async () => {
    findOne.mockResolvedValue({ _id: 'visible' });
    await expect(conversationQueries.conversationDetail(undefined, { _id: 'visible' }, context))
      .resolves.toEqual({ _id: 'visible' });
    expect(checkPermission).toHaveBeenCalledWith('showConversations');
  });

  it('rejects Sales assignment even for an empty batch', async () => {
    checkPermission.mockRejectedValue(new Error('Permission required'));
    await expect(conversationMutations.conversationsAssign(undefined,
      { conversationIds: [], assignedUserId: 'agent' }, context)).rejects.toThrow('Permission required');
    expect(assignUserConversation).not.toHaveBeenCalled();
  });

  it('does not partially assign a batch containing a private conversation', async () => {
    exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(conversationMutations.conversationsAssign(undefined,
      { conversationIds: ['visible', 'private'], assignedUserId: 'agent' }, context))
      .rejects.toThrow('permission to access');
    expect(assignUserConversation).not.toHaveBeenCalled();
  });

  it('preserves authorized assignment', async () => {
    assignUserConversation.mockResolvedValue([{ _id: 'visible' }]);
    await expect(conversationMutations.conversationsAssign(undefined,
      { conversationIds: ['visible'], assignedUserId: 'agent' }, context))
      .resolves.toEqual([{ _id: 'visible' }]);
    expect(assignUserConversation).toHaveBeenCalledWith(['visible'], 'agent');
  });
});
