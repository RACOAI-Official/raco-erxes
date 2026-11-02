import { act, renderHook } from '@testing-library/react';
import { ApolloError } from '@apollo/client';
import { createStore, Provider } from 'jotai';
import type { PropsWithChildren } from 'react';
import { toast } from 'erxes-ui';
import { useComposerSend } from '../composer/useComposerSend';
import type { useConversationMessageAdd } from '../useConversationMessageAdd';
import { messageReplyState } from '../../states/messageReplyState';
import { getProviderMessageId } from '@/inbox/conversation-messages/utils/message';
import { NATIVE_REPLY_KINDS } from '@/inbox/conversation-messages/constants/messageActions';
import { IntegrationType } from '@/types/Integration';
import { parseConversationDraft } from '../../utils/messageInput';

type Options = Parameters<typeof useComposerSend>[0];
type MutationOptions = NonNullable<
  Parameters<
    ReturnType<typeof useConversationMessageAdd>['addConversationMessage']
  >[0]
>;
const mockAddMessage = jest.fn();
const mockGetMentionedUserIds = jest.fn((_content: unknown): string[] => []);

jest.mock('../useConversationMessageAdd', () => ({
  useConversationMessageAdd: () => ({
    addConversationMessage: mockAddMessage,
    loading: false,
  }),
}));
jest.mock('erxes-ui', () => ({
  getBlockAttachments: () => [],
  getMentionedUserIds: (content: unknown) => mockGetMentionedUserIds(content),
  toast: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const textBlock = {
  id: 'text',
  type: 'paragraph',
  props: {
    textAlignment: 'left',
    textColor: 'default',
    backgroundColor: 'default',
  },
  content: [{ type: 'text', text: 'Hello', styles: {} }],
  children: [],
} satisfies NonNullable<Options['content']>[number];
const blocks: NonNullable<Options['content']> = [textBlock];
const html = jest.fn().mockResolvedValue('<p>Hello</p>');
const setup = (overrides: Partial<Options> = {}) => {
  const store = createStore();
  const options: Options = {
    conversationId: 'chat-a',
    draftKey: 'draft-a',
    // The editor is the external boundary; the hook only serializes its blocks.
    editor: { blocksToHTMLLossy: html } as unknown as Options['editor'],
    content: blocks,
    attachments: [],
    mentionedUserIds: [],
    isDiscord: false,
    isInstagram: false,
    isFacebook: false,
    isInternalNote: false,
    isUploading: false,
    responseTemplateId: null,
    resetComposer: jest.fn(),
    onPartialDelivery: jest.fn(),
    ...overrides,
  };
  const hook = renderHook((props: Options) => useComposerSend(props), {
    initialProps: options,
    wrapper: ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    ),
  });
  return { ...hook, store, options };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMentionedUserIds.mockReturnValue([]);
  sessionStorage.clear();
  mockAddMessage.mockImplementation((options: MutationOptions) => {
    const data = {
      conversationMessageAdd: { _id: 'saved', extraData: null },
    };
    options.onCompleted?.(data);
    return Promise.resolve({ data });
  });
});

test.each([
  [IntegrationType.TELEGRAM_MESSENGER, { telegram: { messageIds: ['42'] } }],
  [IntegrationType.DISCORD_MESSENGER, { discordMessageId: '42' }],
])('uses the unified native reply contract for %s', async (kind, extraData) => {
  const { result, store } = setup({
    isDiscord: kind === IntegrationType.DISCORD_MESSENGER,
  });
  const providerMessageId = getProviderMessageId({
    _id: 'canonical',
    content: 'Original',
    createdAt: '',
    extraData,
  });
  act(() =>
    store.set(messageReplyState, {
      messageId: 'canonical',
      providerMessageId,
      preview: 'Original',
      nativeReply: NATIVE_REPLY_KINDS.has(kind),
    }),
  );
  await act(() => result.current.handleSubmit());
  expect(mockAddMessage.mock.calls[0][0].variables).toMatchObject({
    conversationId: 'chat-a',
    replyToMessageId: '42',
    content: '<p>Hello</p>',
    internal: false,
  });
});

test('internal notes never send a provider reply ID and retain all editor blocks', async () => {
  const multiBlock: NonNullable<Options['content']> = [
    { ...textBlock, id: 'blank', content: [] },
    ...blocks,
  ];
  const { result, store } = setup({
    isInternalNote: true,
    content: multiBlock,
  });
  act(() =>
    store.set(messageReplyState, {
      messageId: 'canonical',
      providerMessageId: '42',
      nativeReply: true,
      preview: 'Original',
    }),
  );
  await act(() => result.current.handleSubmit());
  const variables = mockAddMessage.mock.calls[0][0].variables;
  expect(variables.replyToMessageId).toBeUndefined();
  expect(JSON.parse(variables.content)).toEqual(multiBlock);
  expect(variables.internal).toBe(true);
  expect(toast).toHaveBeenCalledWith({ title: 'Internal note added' });
  expect(
    parseConversationDraft(
      JSON.stringify({ blocks: multiBlock, internal: true }),
    ),
  ).toEqual({ blocks: multiBlock, internal: true });
});

test('restored internal notes derive notification recipients from saved blocks', async () => {
  const restored = parseConversationDraft(JSON.stringify({
    blocks: [{ ...textBlock, content: [
      { type: 'mention', props: { _id: 'support', fullName: 'Support Agent' } },
    ] }],
    internal: true,
  }));
  mockGetMentionedUserIds.mockReturnValue(['support']);
  const { result } = setup({
    isInternalNote: true,
    content: restored.blocks,
    mentionedUserIds: [],
  });
  await act(() => result.current.handleSubmit());
  expect(mockGetMentionedUserIds).toHaveBeenCalledWith(restored.blocks);
  expect(mockAddMessage.mock.calls[0][0].variables.mentionedUserIds).toEqual(['support']);
});

test('removed internal-note mentions do not notify stale recipients', async () => {
  const { result } = setup({ isInternalNote: true, mentionedUserIds: ['removed'] });
  await act(() => result.current.handleSubmit());
  expect(mockAddMessage.mock.calls[0][0].variables.mentionedUserIds).toEqual([]);
});

test('Facebook partial delivery retains only unsent attachments for retry', async () => {
  const sent = {
    url: 'sent.png',
    name: 'sent.png',
    type: 'image/png',
    size: 10,
  };
  const pending = { ...sent, url: 'pending.png' };
  mockAddMessage.mockImplementation((options: MutationOptions) => {
    const data = {
      conversationMessageAdd: {
        _id: 'saved',
        extraData: {
          facebookDelivery: {
            status: 'partial' as const,
            textSent: true,
            sentAttachmentUrls: [sent.url],
          },
        },
      },
    };
    options.onCompleted?.(data);
    return Promise.resolve({ data });
  });
  const { result, options } = setup({
    isFacebook: true,
    attachments: [sent, pending],
  });
  await act(() => result.current.handleSubmit());
  expect(options.onPartialDelivery).toHaveBeenCalledWith([pending]);
  expect(options.resetComposer).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Message partially sent' }),
  );
});

test('a send finishing after conversation navigation does not clear the new draft', async () => {
  let finish: (() => void) | undefined;
  mockAddMessage.mockImplementation(
    (options: MutationOptions) =>
      new Promise((resolve) => {
        finish = () => {
          const data = {
            conversationMessageAdd: { _id: 'saved', extraData: null },
          };
          options.onCompleted?.(data);
          resolve({ data });
        };
      }),
  );
  const { result, options, rerender } = setup();
  let sending: Promise<void> | undefined;
  await act(() => {
    sending = result.current.handleSubmit();
    return Promise.resolve();
  });
  sessionStorage.setItem('draft-b', 'new draft');
  rerender({ ...options, conversationId: 'chat-b', draftKey: 'draft-b' });
  await act(async () => {
    finish?.();
    await sending;
  });
  expect(options.resetComposer).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('draft-b')).toBe('new draft');
});

test('Instagram failures retain their provider-specific feedback and the unsent draft', async () => {
  mockAddMessage.mockImplementation((options: MutationOptions) => {
    options.onError?.(
      new ApolloError({ errorMessage: 'Messaging window expired' }),
    );
    return Promise.resolve({});
  });
  const { result, options } = setup({ isInstagram: true });
  await act(() => result.current.handleSubmit());
  expect(options.resetComposer).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Could not send message',
      variant: 'destructive',
    }),
  );
});
