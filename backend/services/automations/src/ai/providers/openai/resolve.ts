// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
import {
  AI_AGENT_DEFAULTS,
  AI_AGENT_PROVIDER_DEFAULT_MODELS,
} from '../../aiAgent/constants';
import type { TOpenAiAgentConnection } from '../../aiAgent/connection';
import { getFirstAiProviderEnv } from '../env';
import { TAiProviderResolutionInput } from '../types';

type TOpenAiResolutionInput = Omit<TAiProviderResolutionInput, 'connection'> & {
  connection: TOpenAiAgentConnection;
};

export const resolveOpenAiConnection = ({
  subdomain,
  connection,
}: TOpenAiResolutionInput): TOpenAiAgentConnection => {
  const config = connection.config || {};

  return {
    ...connection,
    provider: 'openai',
    model:
      connection.model?.trim() ||
      getFirstAiProviderEnv({
        names: ['RACO_LLM_MODEL', 'OPENAI_DEFAULT_MODEL'],
        defaultValue: AI_AGENT_PROVIDER_DEFAULT_MODELS.openai,
        subdomain,
      }),
    config: {
      ...config,
      apiKey:
        config.apiKey?.trim() ||
        getFirstAiProviderEnv({
          names: ['RACO_LLM_API_KEY', 'OPENAI_API_KEY'],
          subdomain,
        }),
      baseUrl:
        config.baseUrl?.trim() ||
        getFirstAiProviderEnv({
          names: ['RACO_LLM_BASE_URL', 'OPENAI_BASE_URL'],
          defaultValue: AI_AGENT_DEFAULTS.openAiBaseUrl,
          subdomain,
        }),
    },
  };
};
