import {
  buildAiAgentFormSchema,
  normalizeAiAgentFormValues,
} from '../AiAgentFormSchema';

describe('Raco agent connection form', () => {
  const makeForm = () => {
    const values = normalizeAiAgentFormValues();
    values.name = 'Raco agent';
    return values;
  };

  it('defaults to qwen3 and accepts server-configured credentials', () => {
    const values = makeForm();
    expect(values.connection.provider).toBe('openai');
    expect(values.connection.model).toBe('qwen3');
    expect(
      buildAiAgentFormSchema({ requireApiKey: true }).safeParse(values).success,
    ).toBe(true);
  });

  it('requires credentials for an explicit endpoint override on a new agent', () => {
    const values = makeForm();
    values.connection.config.baseUrl = 'https://example.com/v1';
    expect(
      buildAiAgentFormSchema({ requireApiKey: true }).safeParse(values).success,
    ).toBe(false);
  });

  it('accepts an explicit endpoint with its own key', () => {
    const values = makeForm();
    values.connection.config.baseUrl = 'https://example.com/v1';
    values.connection.config.apiKey = 'test-credential';
    expect(
      buildAiAgentFormSchema({ requireApiKey: true }).safeParse(values).success,
    ).toBe(true);
  });
});
