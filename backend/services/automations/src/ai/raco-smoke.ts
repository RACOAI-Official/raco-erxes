import { parseAiAgentInput } from './aiAgent/contract';
import { invokeAiProvider } from './bridge';

const main = async (): Promise<void> => {
  const agent = parseAiAgentInput({
    name: 'Raco connectivity check',
    connection: {
      provider: 'openai',
      model: process.env.RACO_LLM_MODEL || 'qwen3',
      config: {},
    },
    runtime: { timeoutMs: 30000, maxTokens: 2000 },
  });
  const result = await invokeAiProvider(agent, [
    { role: 'user', content: 'Reply with one short greeting for Raco AI CRM.' },
  ]);
  if (!result.text.trim()) throw new Error('The provider returned no answer');
  process.stdout.write(
    `PASS: Raco AI provider bridge returned ${result.text.length} characters.\n`,
  );
};

main().then(
  () => process.exit(0),
  () => {
    process.stderr.write(
      'Raco AI provider smoke check failed. Check endpoint availability and server-side credentials.\n',
    );
    process.exit(1);
  },
);
