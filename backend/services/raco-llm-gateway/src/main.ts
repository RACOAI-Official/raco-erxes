import express, { type Express } from 'express';
import { z } from 'zod';
import { createRacoLlmGatewayFromEnv } from './gateway';

/**
 * MOCK HTTP entry for the Raco LLM gateway.
 * Default port 3390 — isolated from erxes core (3300) and gateway (4000).
 */
const port = Number(process.env.RACO_LLM_GATEWAY_PORT || 3390);
const gateway = createRacoLlmGatewayFromEnv();

const completionBodySchema = z.object({
  model: z.string().min(1).default('mock-raco-default'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    )
    .min(1),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const app: Express = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'raco-llm-gateway',
    mock: true,
    status: gateway.getStatus(),
  });
});

app.post('/v1/completions', async (req, res) => {
  const parsed = completionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const result = await gateway.complete(parsed.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    res.status(500).json({ error: 'completion_failed', message });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    // Intentionally minimal boot log — no secrets.
    // eslint-disable-next-line no-console
    console.log(
      `[raco-llm-gateway] MOCK listening on :${port} status=${JSON.stringify(gateway.getStatus())}`,
    );
  });
}

export { app };
