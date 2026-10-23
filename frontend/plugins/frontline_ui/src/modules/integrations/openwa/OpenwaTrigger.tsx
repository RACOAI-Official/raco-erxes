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
}: AutomationTriggerFormProps<Record<string, never>>) => {
  useAutomationRemoteFormSubmit({
    formRef,
    callback: () => onSaveTriggerConfig({}),
  });
  return <OpenwaTriggerSummary />;
};
