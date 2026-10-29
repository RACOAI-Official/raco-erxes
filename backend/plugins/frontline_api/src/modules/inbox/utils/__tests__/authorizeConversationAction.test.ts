import type { IContext } from '~/connectionResolvers';
import { authorizeConversationAction } from '../authorizeConversationAction';
import { visibleChannelsFilter } from '@/channel/utils';

jest.mock('@/channel/utils', () => ({ visibleChannelsFilter: jest.fn() }));

describe('staff conversation authorization', () => {
  const getConversation = jest.fn();
  const exists = jest.fn();
  const lean = jest.fn();
  const checkPermission = jest.fn();
  const context = {
    subdomain: 'test',
    user: { _id: 'support' },
    checkPermission,
    models: {
      Conversations: { getConversation },
      Integrations: { findOne: () => ({ lean }) },
      Channels: { exists },
    },
  } as unknown as IContext;

  beforeEach(() => {
    jest.resetAllMocks();
    checkPermission.mockResolvedValue(undefined);
    getConversation.mockResolvedValue({ integrationId: 'mail' });
    lean.mockResolvedValue({ channelId: 'private-owner-channel' });
    exists.mockResolvedValue(true);
    jest.mocked(visibleChannelsFilter).mockResolvedValue({ createdBy: 'support' });
  });

  it('denies a Sales user before looking up any conversation', async () => {
    checkPermission.mockRejectedValue(new Error('Permission required'));
    await expect(authorizeConversationAction(context, 'conversationsAssign', ['audit']))
      .rejects.toThrow('Permission required');
    expect(getConversation).not.toHaveBeenCalled();
  });

  it('denies a Support user access to the owner private inbox', async () => {
    exists.mockResolvedValue(false);
    await expect(authorizeConversationAction(context, 'showConversations', ['private']))
      .rejects.toThrow('permission to access');
    expect(exists).toHaveBeenCalledWith({ $and: [
      { _id: 'private-owner-channel' }, { createdBy: 'support' },
    ] });
  });

  it('permits the action only when both action and inbox access pass', async () => {
    await expect(authorizeConversationAction(context, 'conversationsAssign', ['audit']))
      .resolves.toBeUndefined();
    expect(checkPermission).toHaveBeenCalledWith('conversationsAssign');
    expect(getConversation).toHaveBeenCalledWith('audit');
  });

  it('rejects a mixed bulk selection instead of authorizing its visible subset', async () => {
    exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(authorizeConversationAction(context, 'conversationsChangeStatus', ['visible', 'private']))
      .rejects.toThrow('permission to access');
    expect(getConversation.mock.calls).toEqual([['visible'], ['private']]);
  });

  it('denies archived or missing integrations', async () => {
    lean.mockResolvedValue(null);
    await expect(authorizeConversationAction(context, 'showConversations', ['audit']))
      .rejects.toThrow('permission to access');
  });

  it('requires authentication even if an action checker resolves', async () => {
    await expect(authorizeConversationAction({ ...context, user: null } as unknown as IContext,
      'showConversations', ['audit'])).rejects.toThrow('Authentication required');
  });

  it('rejects empty bulk operations after checking permission', async () => {
    await expect(authorizeConversationAction(context, 'conversationsAssign', []))
      .rejects.toThrow('At least one conversation');
    expect(checkPermission).toHaveBeenCalled();
  });
});
