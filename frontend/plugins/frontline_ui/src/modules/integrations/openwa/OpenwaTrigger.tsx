import {
  useAutomationRemoteFormSubmit,
  type AutomationTriggerFormProps,
} from 'ui-modules';
import { useOpenwaTranslation } from './translations';

export const OpenwaTriggerSummary = () => {
  const { t } = useOpenwaTranslation();
  return <p className="text-sm text-muted-foreground">{t('trigger')}</p>;
};

export const OpenwaTriggerForm = ({
  formRef,
  onSaveTriggerConfig,
}: AutomationTriggerFormProps<{ event: 'message.received' }>) => {
  useAutomationRemoteFormSubmit({
    formRef,
    // The builder requires a non-empty config for every custom trigger.
    callback: () => onSaveTriggerConfig({ event: 'message.received' }),
  });
  return <OpenwaTriggerSummary />;
};
