import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { AutomationNodeLibraryTabContent } from '@/automations/components/builder/sidebar/components/library/AutomationNodeLibraryTabContent';
import { WorkflowEditScopeProvider } from '@/automations/context/WorkflowEditScopeProvider';
import { AutomationNodeType } from '@/automations/types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('erxes-ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Command: {
    Empty: () => null,
    Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));
jest.mock('@/automations/hooks/useAutomationNodes', () => ({
  useAutomationNodes: () => ({ isEmpty: () => true }),
}));
jest.mock('@/automations/components/builder/sidebar/hooks/useAutomationBuilderSidebarHooks', () => ({
  useAutomationBuilderSidebarHooks: () => ({ openNodeLibrary: jest.fn() }),
}));
jest.mock('@/automations/components/builder/sidebar/context/AutomationNodeLibraryProvider', () => ({
  useAutomationNodeLibraryProvider: () => ({ onDragStart: jest.fn(), onSelectNode: jest.fn() }),
}));
jest.mock('@/automations/components/builder/sidebar/hooks/useAutomationNodeLibraryGroups', () => ({
  useAutomationNodeLibraryGroups: () => [{ name: 'Actions', list: [{ type: 'delay', label: 'Wait for a review' }] }],
}));
jest.mock('@/automations/components/builder/sidebar/components/library/NodeLibraryRow', () => ({
  NodeLibraryRow: ({ item }: { item: { label: string } }) => <div>{item.label}</div>,
}));

describe('First action in a reusable workflow template', () => {
  it('shows available actions for an empty standalone template', () => {
    const { getByText, queryByText } = render(
      <WorkflowEditScopeProvider workflowId="new-workflow-template">
        <AutomationNodeLibraryTabContent type={AutomationNodeType.Action} list={[]} />
      </WorkflowEditScopeProvider>,
    );
    expect(getByText('Wait for a review')).toBeTruthy();
    expect(queryByText('choose-a-trigger')).toBeNull();
  });

  it('still requires a trigger for an empty root automation', () => {
    const { getByText, queryByText } = render(
      <AutomationNodeLibraryTabContent type={AutomationNodeType.Action} list={[]} />,
    );
    expect(getByText('choose-a-trigger')).toBeTruthy();
    expect(queryByText('Wait for a review')).toBeNull();
  });
});
