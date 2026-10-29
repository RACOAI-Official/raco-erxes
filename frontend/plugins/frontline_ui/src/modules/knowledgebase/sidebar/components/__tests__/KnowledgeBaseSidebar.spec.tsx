import { render, screen } from '@testing-library/react';
import { KnowledgeBaseSidebar } from '../KnowledgeBaseSidebar';

let mockCreateTopic: boolean | null = true;
let mockLoading = true;
let mockTopicId: string | undefined;
let mockTopics = [{ _id: 'existing', title: 'Existing topic' }];
const mockSetCreateTopic = jest.fn((value: boolean | null) => {
  mockCreateTopic = value;
});
const mockSetOpen = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('jotai', () => ({
  useAtom: () => [null, jest.fn()],
  useAtomValue: () => false,
}));
jest.mock('@/knowledgebase/sidebar/states/kbSidebarWidthState', () => ({
  kbSidebarResizingAtom: 'resizing',
  kbSidebarWidthAtom: 'width',
}));
jest.mock('erxes-ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Button: Container,
    cn: () => '',
    Separator: () => null,
    useQueryState: () => [mockCreateTopic, mockSetCreateTopic],
    Sidebar: {
      Panel: React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(
        ({ children }, ref) => <div ref={ref}>{children}</div>,
      ),
      PanelTrigger: () => null,
      Group: Container,
      GroupContent: Container,
      Menu: Container,
      MenuItem: Container,
      MenuSkeleton: () => null,
    },
  };
});
jest.mock('@/knowledgebase/categories/components/CategoryDrawer', () => ({
  CategoryDrawer: () => null,
}));
jest.mock('@/knowledgebase/sidebar/components/KbResizeHandle', () => ({
  KbResizeHandle: () => null,
}));
jest.mock('@/knowledgebase/sidebar/components/TopicTreeItem', () => ({
  TopicTreeItem: () => null,
}));
jest.mock('@/knowledgebase/sidebar/hooks/useKnowledgeBaseRoute', () => ({
  useKnowledgeBaseRoute: () => ({ topicId: mockTopicId }),
}));
jest.mock('@/knowledgebase/sidebar/hooks/useTopicOpenState', () => ({
  useTopicOpenState: () => ({ setOpen: mockSetOpen }),
}));
jest.mock('@/knowledgebase/topics/hooks/useTopics', () => ({
  useTopics: () => ({ topics: mockTopics, loading: mockLoading }),
}));
jest.mock('@/knowledgebase/topics/components/TopicDrawer', () => ({
  TopicDrawer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">New Topic</div> : null,
}));

describe('topic creation across index navigation', () => {
  beforeEach(() => {
    mockCreateTopic = true;
    mockLoading = true;
    mockTopicId = undefined;
    mockTopics = [{ _id: 'existing', title: 'Existing topic' }];
    mockSetCreateTopic.mockClear();
  });

  it('retains the Boolean request until the index redirect destination mounts', () => {
    const { rerender, unmount } = render(<KnowledgeBaseSidebar />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockSetCreateTopic).not.toHaveBeenCalled();
    mockLoading = false;
    rerender(<KnowledgeBaseSidebar />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockSetCreateTopic).not.toHaveBeenCalled();
    unmount();
    mockTopicId = 'existing';
    render(<KnowledgeBaseSidebar />);
    expect(screen.getByRole('dialog').textContent).toBe('New Topic');
    expect(mockSetCreateTopic).toHaveBeenCalledWith(null);
  });

  it('opens on the index when there is no topic to redirect to', () => {
    mockLoading = false;
    mockTopics = [];
    render(<KnowledgeBaseSidebar />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(mockSetCreateTopic).toHaveBeenCalledWith(null);
  });

  it('does not open a drawer for a false query flag', () => {
    mockLoading = false;
    mockTopicId = 'existing';
    mockCreateTopic = false;
    render(<KnowledgeBaseSidebar />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockSetCreateTopic).not.toHaveBeenCalled();
  });
});
