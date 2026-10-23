import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, Input, Textarea, toast } from 'erxes-ui';
import {
  useAutomationRemoteFormSubmit,
  type AutomationActionFormProps,
  type AutomationActionNodeConfigProps,
} from 'ui-modules';
import { useOpenwaTranslation } from './translations';

const schema = z.object({
  customerId: z.string().optional(),
  text: z.string().trim().min(1).max(65536),
});
type OpenwaActionConfig = z.infer<typeof schema>;

export const OpenwaActionForm = ({
  formRef,
  currentAction,
  onSaveActionConfig,
}: AutomationActionFormProps<OpenwaActionConfig>) => {
  const { t } = useOpenwaTranslation();
  const form = useForm<OpenwaActionConfig>({
    resolver: zodResolver(schema),
    defaultValues: { text: '', customerId: '', ...currentAction.config },
  });
  useAutomationRemoteFormSubmit({
    formRef,
    callback: () => {
      form.handleSubmit(onSaveActionConfig, () =>
        toast({ title: t('messageRequired'), variant: 'destructive' }),
      )();
    },
  });
  return (
    <Form {...form}>
      <div className="space-y-4">
        <Form.Field
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>{t('recipientBinding')}</Form.Label>
              <Form.Control>
                <Input {...field} placeholder="{{ input.customerId }}" />
              </Form.Control>
              <Form.Description>{t('recipientHelp')}</Form.Description>
              <Form.Message />
            </Form.Item>
          )}
        />
        <Form.Field
          control={form.control}
          name="text"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>{t('message')}</Form.Label>
              <Form.Control>
                <Textarea {...field} rows={6} />
              </Form.Control>
              <Form.Message />
            </Form.Item>
          )}
        />
      </div>
    </Form>
  );
};

export const OpenwaActionSummary = ({
  config,
}: AutomationActionNodeConfigProps<OpenwaActionConfig>) => {
  const { t } = useOpenwaTranslation();
  return (
    <p className="text-xs whitespace-pre-wrap">
      {config?.text || t('messageRequired')}
    </p>
  );
};
