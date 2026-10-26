import type { TOpenAiAgentConnection } from '../aiAgent/connection';
import { getAiProviderEnv } from './env';

export const resolveRacoFallback = (
  primaryBaseUrl: string,
  subdomain?: string,
): TOpenAiAgentConnection | undefined => {
  const get = (name: string, defaultValue = ''): string =>
    getAiProviderEnv({ name, defaultValue, subdomain });
  const primary = get('RACO_LLM_BASE_URL').replace(/\/+$/, '');
  if (
    !primary ||
    primaryBaseUrl.replace(/\/+$/, '') !== primary ||
    get('RACO_LLM_FALLBACK_ENABLED').toLowerCase() !== 'true'
  ) {
    return undefined;
  }

  const apiKey = get('GEMINI_API_KEY');
  if (!apiKey) {
    return undefined;
  }

  return {
    provider: 'openai',
    model: get('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
    config: {
      apiKey,
      baseUrl: get(
        'GEMINI_BASE_URL',
        'https://generativelanguage.googleapis.com/v1beta/openai',
      ),
      headers: {},
    },
  };
};
