import { Alert, Button } from 'erxes-ui';
import { OpenwaCompose } from './OpenwaCompose';
import { useOpenwaTranslation } from './translations';

export const OpenwaDetail = () => {
  const { t } = useOpenwaTranslation();
  return (
    <div className="space-y-4">
      <OpenwaCompose />
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
