import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';

import {
  getInstance,
  init,
  registerRemotes,
} from '@module-federation/enhanced/runtime';

import { NODE_ENV, REACT_APP_API_URL } from 'erxes-ui';

import '@blocknote/shadcn/style.css';
import './styles.css';

import { App } from '@/app/components/App';
import { ClientConfigError } from '@/error-handler/components/ClientConfigError';
import { initSentry } from './sentry';
import { SaasPortal } from './modules/raco-saas/SaasPortal';

// Install browser error handlers as early as possible, before any rendering.
if (!window.location.pathname.startsWith('/saas') && window.location.hostname !== window.env?.RACO_SAAS_DOMAIN) {
  initSentry();
}

async function initFederation() {
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement,
  );

  // The public portal must render without tenant discovery or an owner session.
  if (window.location.pathname === '/saas' || window.location.pathname === '/saas/' ||
      window.location.hostname === window.env?.RACO_SAAS_DOMAIN) {
    root.render(<SaasPortal />);
    return;
  }

  if (NODE_ENV === 'development') {
    // Nx serves monorepo plugins. A plugin outside the monorepo announces its
    // UI entry to core-api, which is how production loads every plugin.
    const localRemotes = new Set(
      getInstance()?.options.remotes.map(({ name }) => name),
    );
    const remotes: Parameters<typeof registerRemotes>[0] = await fetch(
      `${REACT_APP_API_URL}/get-frontend-plugins`,
      { signal: AbortSignal.timeout(2000) },
    )
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => []);
    const externalRemotes = remotes.filter(
      ({ name }) => !localRemotes.has(name),
    );

    if (externalRemotes.length) {
      registerRemotes(externalRemotes);
    }

    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } else {
    // A hung gateway must surface ClientConfigError, not a blank page.
    fetch(`${REACT_APP_API_URL}/get-frontend-plugins`, {
      signal: AbortSignal.timeout(15000),
    })
      .then((res) => res.json())
      .then((data) => {
        init({
          name: 'core',
          remotes: data,
        });

        root.render(<App />);
      })
      .catch((error: unknown) => {
        console.error(
          'Failed to initialize frontend plugins:',
          error instanceof Error ? error.message : String(error),
        );

        root.render(
          <ClientConfigError
            error={
              error instanceof Error
                ? error
                : new Error('Failed to initialize frontend plugins')
            }
          />,
        );
      });
  }
}

initFederation().catch((err) => {
  console.error('Failed to initialize module federation:', err);
});
