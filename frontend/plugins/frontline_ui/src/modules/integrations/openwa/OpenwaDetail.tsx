import { useMutation, useQuery } from '@apollo/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Form, Input, Spinner, toast } from 'erxes-ui';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import { SelectBrand } from 'ui-modules';
import { z } from 'zod';
import { ADD_INTEGRATION } from '../graphql/mutations/AddIntegration';
import { GET_INTEGRATIONS_BY_KIND } from '../graphql/queries/getIntegrations';
import { OpenwaCompose } from './OpenwaCompose';
import { useOpenwaTranslation } from './translations';

const setupSchema = z.object({
  name: z.string().trim().min(1),
  brandId: z.string().min(1),
});

type SetupValues = z.infer<typeof setupSchema>;

export const OpenwaDetail = () => {
  const { t } = useOpenwaTranslation();
  const { id: channelId } = useParams();
  const { data, loading, error, refetch } = useQuery(GET_INTEGRATIONS_BY_KIND, {
    variables: {
      kind: 'openwa-messenger',
      channelId: channelId ?? '',
      limit: 10,
    },
    skip: !channelId,
  });
  const [addIntegration, { loading: creating }] = useMutation(ADD_INTEGRATION);
  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { name: 'WhatsApp (OpenWA)', brandId: '' },
  });
  const integration = data?.integrations?.list?.find(
    (item) => item?.kind === 'openwa-messenger',
  );

  const create = async ({ name, brandId }: SetupValues) => {
    if (!channelId) return;
    try {
      const result = await addIntegration({
        variables: { kind: 'openwa-messenger', name, brandId, channelId },
        refetchQueries: [
          'IntegrationsTotalCount',
          'IntegrationsGetUsedTypesByChannel',
        ],
      });
      if (!result.data?.integrationsCreateExternalIntegration?._id)
        throw new Error(t('connectFailed'));
      await refetch();
      toast({ title: t('connected') });
    } catch (cause: unknown) {
      toast({
        title: t('connectFailed'),
        description: cause instanceof Error ? cause.message : t('connectFailed'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {loading && <Spinner />}
      {error && (
        <Alert>
          <Alert.Description>{error.message}</Alert.Description>
        </Alert>
      )}
      {!loading && !error && !channelId && <p>{t('channelRequired')}</p>}
      {!loading && !error && channelId && !integration && (
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(create)}>
            <h3 className="font-semibold">{t('connect')}</h3>
            <Form.Field
              control={form.control}
              name="name"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label>{t('connectionName')}</Form.Label>
                  <Form.Control><Input {...field} /></Form.Control>
                  <Form.Message />
                </Form.Item>
              )}
            />
            <Form.Field
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label>{t('brand')}</Form.Label>
                  <Form.Control>
                    <SelectBrand
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('chooseBrand')}
                      className="w-full"
                    />
                  </Form.Control>
                  <Form.Message />
                </Form.Item>
              )}
            />
            <Button type="submit" disabled={creating}>
              {creating ? t('connecting') : t('connect')}
            </Button>
          </form>
        </Form>
      )}
      {integration && (
        <>
          <p role="status">{t('connected')}: {integration.name}</p>
          <OpenwaCompose />
        </>
      )}
      <Alert>
        <Alert.Description className="space-y-3">
          <p>{t('setup')}</p>
          <p>{t('usage')}</p>
          <p>{t('pairing')}</p>
          <Button asChild variant="outline">
            <a href="https://wa.racoai.io" target="_blank" rel="noreferrer">
              {t('dashboard')}
            </a>
          </Button>
        </Alert.Description>
      </Alert>
    </div>
  );
};
