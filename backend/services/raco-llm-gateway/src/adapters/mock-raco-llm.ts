import type {
  RacoLlmAdapter,
  RacoLlmCompletionRequest,
  RacoLlmCompletionResponse,
} from './types';

let mockCounter = 0;

/**
 * MOCK Raco LLM adapter — clearly marked; no network, no secrets.
 * Replace with a real Raco LLM adapter only when credentials are provided.
 */
export class MockRacoLlmAdapter implements RacoLlmAdapter {
  readonly providerId = 'mock-raco-llm' as const;
  readonly isMock = true;

  async complete(
    request: RacoLlmCompletionRequest,
  ): Promise<RacoLlmCompletionResponse> {
    mockCounter += 1;
    const lastUser = [...request.messages]
      .reverse()
      .find((message) => message.role === 'user');
    const promptPreview = (lastUser?.content || '').slice(0, 120);
    const content = [
      '[MOCK Raco LLM — not a production model]',
      `provider=${this.providerId}`,
      `model=${request.model}`,
      promptPreview
        ? `echo=${JSON.stringify(promptPreview)}`
        : 'echo=(empty user message)',
    ].join('\n');

    const promptTokens = request.messages.reduce(
      (sum, message) => sum + Math.ceil(message.content.length / 4),
      0,
    );
    const completionTokens = Math.ceil(content.length / 4);

    return {
      id: `mock-raco-${mockCounter}`,
      provider: this.providerId,
      model: request.model,
      content,
      mock: true,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }
}

export function createMockRacoLlmAdapter(): RacoLlmAdapter {
  return new MockRacoLlmAdapter();
}
