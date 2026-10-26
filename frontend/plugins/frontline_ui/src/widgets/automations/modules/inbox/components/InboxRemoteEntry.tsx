import { lazy } from 'react';
import {
  OpenwaActionForm,
  OpenwaActionSummary,
} from '@/integrations/openwa/OpenwaAction';
import {
  OpenwaTriggerForm,
  OpenwaTriggerSummary,
} from '@/integrations/openwa/OpenwaTrigger';
import {
  AutomationRemoteEntryProps,
  AutomationRemoteEntryTypes,
  AutomationRemoteEntryWrapper,
  splitAutomationNodeType,
} from 'ui-modules';
import { InboxMessageTriggerForm } from './trigger/InboxMessageTriggerForm';
import { MessengerMessageTriggerNodeContent } from './trigger/MessengerMessageTriggerNodeContent';
import { InboxMessageActionForm } from './action/InboxMessageActionForm';
import { InboxMessageActionConfig } from './action/InboxMessageActionConfig';
import { AutomationHistoryName } from './AutomationHistoryName';
import { AutomationHistoryResult } from './AutomationHistoryResult';

const ConversationEventTriggerForm = lazy(() =>
  import('./trigger/ConversationEventTriggerForm').then((module) => ({
    default: module.ConversationEventTriggerForm,
  })),
);

const ConversationEventTriggerNodeContent = lazy(() =>
  import('./trigger/ConversationEventTriggerNodeContent').then((module) => ({
    default: module.ConversationEventTriggerNodeContent,
  })),
);

export const InboxRemoteEntry = (props: AutomationRemoteEntryProps) => {
  return (
    <AutomationRemoteEntryWrapper
      props={props}
      remoteEntries={{
        triggerForm: renderTriggerForm,
        triggerConfigContent: renderTriggerConfigContent,
        actionForm: renderActionForm,
        actionNodeConfiguration: renderActionConfig,
        historyName: AutomationHistoryName,
        historyActionResult: AutomationHistoryResult,
      }}
    />
  );
};

function renderTriggerForm(props: AutomationRemoteEntryTypes['triggerForm']) {
  const triggerType = props.activeTrigger?.type || '';
  const [, , collectionType] = splitAutomationNodeType(triggerType);

  if (collectionType === 'openwaMessages')
    return <OpenwaTriggerForm {...props} />;

  if (collectionType === 'messages') {
    return <InboxMessageTriggerForm {...props} />;
  }

  return <ConversationEventTriggerForm {...props} />;
}

function renderTriggerConfigContent(
  props: AutomationRemoteEntryTypes['triggerConfigContent'],
) {
  const [, , collectionType] = splitAutomationNodeType(props.type || '');

  if (collectionType === 'openwaMessages') return <OpenwaTriggerSummary />;

  if (collectionType === 'messages') {
    return <MessengerMessageTriggerNodeContent {...props} />;
  }

  return <ConversationEventTriggerNodeContent {...props} />;
}

function renderActionForm(props: AutomationRemoteEntryTypes['actionForm']) {
  const [, , collectionType] = splitAutomationNodeType(
    props.currentAction.type || '',
  );
  if (collectionType === 'openwaMessages')
    return <OpenwaActionForm {...props} />;
  return <InboxMessageActionForm {...props} />;
}

function renderActionConfig(
  props: AutomationRemoteEntryTypes['actionNodeConfiguration'],
) {
  const [, , collectionType] = splitAutomationNodeType(
    props.actionData.type || '',
  );
  if (collectionType === 'openwaMessages')
    return <OpenwaActionSummary {...props} />;
  return <InboxMessageActionConfig {...props} />;
}
