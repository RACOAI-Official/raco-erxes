export type RacoLlmProviderId = 'mock-raco-llm' | 'raco-llm' | 'free-tier-fallback';

export interface RacoLlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RacoLlmCompletionRequest {
  model: string;
  messages: RacoLlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface RacoLlmCompletionResponse {
  id: string;
  provider: RacoLlmProviderId;
  model: string;
  content: string;
  /** True when this response came from the mock adapter */
  mock: boolean;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface RacoLlmAdapter {
  readonly providerId: RacoLlmProviderId;
  readonly isMock: boolean;
  complete(
    request: RacoLlmCompletionRequest,
  ): Promise<RacoLlmCompletionResponse>;
}
