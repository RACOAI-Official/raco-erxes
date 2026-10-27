import { gql, useMutation } from '@apollo/client';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { Button, Form, Textarea, toast } from 'erxes-ui';
import { SelectCustomer } from 'ui-modules';
import { useOpenwaTranslation } from './translations';

const compose = gql`
  mutation frontlineOpenwaComposeMutation(
    $customerId: String!
    $text: String!
    $requestId: String!
  ) {
    frontlineOpenwaCompose(
      customerId: $customerId
      text: $text
      requestId: $requestId
    ) {
      _id
      conversationId
    }
  }
`;
const schema = z.object({
  customerId: z.string().min(1),
  text: z.string().trim().min(1).max(4096),
});
type Values = z.infer<typeof schema>;

export const OpenwaCompose = () => {
  const { t } = useOpenwaTranslation();
  const navigate = useNavigate();
  const requestId = useRef(crypto.randomUUID());
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: '', text: '' },
  });
  const [send, { loading }] = useMutation<
    { frontlineOpenwaCompose: { _id: string; conversationId: string } },
    Values & { requestId: string }
  >(compose);
  const onSubmit = async (values: Values) => {
    try {
      const result = await send({
        variables: { ...values, requestId: requestId.current },
        refetchQueries: ['Conversations', 'GetMyChannels'],
      });
      if (!result.data?.frontlineOpenwaCompose)
        throw new Error(t('sendFailed'));
      requestId.current = crypto.randomUUID();
      form.reset();
      toast({ title: t('sent') });
      navigate(
        `/frontline/inbox?conversationId=${encodeURIComponent(
          result.data.frontlineOpenwaCompose.conversationId,
        )}`,
      );
    } catch (error: unknown) {
      toast({
        title: t('sendFailed'),
        description: error instanceof Error ? error.message : t('sendFailed'),
        variant: 'destructive',
      });
    }
  };
  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <h3 className="font-semibold">{t('compose')}</h3>
        <Form.Field
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>{t('contact')}</Form.Label>
              <SelectCustomer.FormItem
                mode="single"
                value={field.value}
                onValueChange={field.onChange}
              />
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
                <Textarea {...field} rows={4} />
              </Form.Control>
              <Form.Message />
            </Form.Item>
          )}
        />
        <Button type="submit" disabled={loading}>
          {loading ? t('sending') : t('send')}
        </Button>
      </form>
    </Form>
  );
};
