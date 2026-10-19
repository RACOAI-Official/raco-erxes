import {
  createMockRacoLlmAdapter,
  createRacoLlmGatewayFromEnv,
  RacoLlmGateway,
} from '../index';

describe('raco-llm-gateway', () => {
  it('marks mock adapter responses as mock', async () => {
    const gateway = new RacoLlmGateway({
      primaryAdapter: createMockRacoLlmAdapter(),
      primaryProvider: 'mock-raco-llm',
    });
    const result = await gateway.complete({
      model: 'mock-raco-default',
      messages: [{ role: 'user', content: 'hello raco' }],
    });
    expect(result.mock).toBe(true);
    expect(result.provider).toBe('mock-raco-llm');
    expect(result.content).toContain('[MOCK Raco LLM');
    expect(result.content).toContain('hello raco');
  });

  it('falls back to mock when API key missing for non-mock provider', () => {
    const gateway = createRacoLlmGatewayFromEnv({
      RACO_LLM_PROVIDER: 'raco-llm',
      RACO_LLM_API_KEY: '',
    });
    expect(gateway.getStatus().primaryIsMock).toBe(true);
    expect(gateway.getStatus().primaryProvider).toBe('mock-raco-llm');
  });
});
