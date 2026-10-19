import { createMockRacoLlmAdapter } from './adapters/mock-raco-llm';
import type {
  RacoLlmAdapter,
  RacoLlmCompletionRequest,
  RacoLlmCompletionResponse,
  RacoLlmProviderId,
} from './adapters/types';

export interface RacoLlmGatewayOptions {
  /** Default adapter when RACO_LLM_PROVIDER is unset or mock */
  primaryAdapter?: RacoLlmAdapter;
  fallbackAdapter?: RacoLlmAdapter | null;
  primaryProvider?: RacoLlmProviderId;
}

/**
 * Isolated LLM gateway: Raco LLM primary + optional free-tier fallback.
 * Until real credentials exist, primary is the MOCK adapter.
 */
export class RacoLlmGateway {
  private readonly primary: RacoLlmAdapter;
  private readonly fallback: RacoLlmAdapter | null;
  private readonly primaryProvider: RacoLlmProviderId;

  constructor(options: RacoLlmGatewayOptions = {}) {
    this.primaryProvider = options.primaryProvider || 'mock-raco-llm';
    this.primary = options.primaryAdapter || createMockRacoLlmAdapter();
    this.fallback = options.fallbackAdapter ?? null;
  }

  getStatus(): {
    primaryProvider: RacoLlmProviderId;
    primaryIsMock: boolean;
    fallbackConfigured: boolean;
  } {
    return {
      primaryProvider: this.primaryProvider,
      primaryIsMock: this.primary.isMock,
      fallbackConfigured: Boolean(this.fallback),
    };
  }

  async complete(
    request: RacoLlmCompletionRequest,
  ): Promise<RacoLlmCompletionResponse> {
    try {
      return await this.primary.complete(request);
    } catch (primaryError) {
      if (!this.fallback) {
        throw primaryError;
      }
      return this.fallback.complete(request);
    }
  }
}

export function createRacoLlmGatewayFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RacoLlmGateway {
  const provider = (env.RACO_LLM_PROVIDER ||
    'mock-raco-llm') as RacoLlmProviderId;

  if (provider !== 'mock-raco-llm' && !env.RACO_LLM_API_KEY?.trim()) {
    // Safe default: stay on mock when credentials are missing.
    return new RacoLlmGateway({
      primaryProvider: 'mock-raco-llm',
      primaryAdapter: createMockRacoLlmAdapter(),
    });
  }

  if (provider === 'mock-raco-llm') {
    return new RacoLlmGateway({
      primaryProvider: 'mock-raco-llm',
      primaryAdapter: createMockRacoLlmAdapter(),
    });
  }

  // Real Raco LLM / free-tier adapters are not implemented yet (credentials pending).
  // Keep behavior explicit rather than inventing network clients.
  return new RacoLlmGateway({
    primaryProvider: 'mock-raco-llm',
    primaryAdapter: createMockRacoLlmAdapter(),
  });
}
