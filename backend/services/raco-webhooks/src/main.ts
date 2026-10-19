import express, { type Express } from 'express';
import { z } from 'zod';
import { loadRacoWebhookConfig } from './config/load';
import { RACO_WEBHOOK_EVENTS } from './events/catalog';
import { createWebhookEnvelope, publishRacoWebhookEvent } from './publisher';
import { deliverRacoWebhookEvent } from './delivery/deliver';

/**
 * Standalone outbound webhook sidecar for Raco product integrations.
 * Default port 3391. Not a multi-tenant SaaS management layer.
 */
const config = loadRacoWebhookConfig();
const app: Express = express();
app.use(express.json({ limit: '1mb' }));

const publishBodySchema = z.object({
  type: z.string().min(1),
  data: z.record(z.unknown()).default({}),
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'raco-webhooks',
    enabled: config.enabled,
    endpointCount: config.endpoints.length,
    events: RACO_WEBHOOK_EVENTS,
    productShape: 'standalone',
  });
});

app.get('/v1/events', (_req, res) => {
  res.json({ events: RACO_WEBHOOK_EVENTS });
});

app.get('/v1/subscriptions', (_req, res) => {
  res.json({
    enabled: config.enabled,
    endpoints: config.endpoints.map((endpoint) => ({
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      enabled: endpoint.enabled,
    })),
  });
});

app.post('/v1/events', async (req, res) => {
  if (!config.enabled) {
    res.status(503).json({
      error: 'webhooks_disabled',
      hint: 'Set RACO_WEBHOOKS_ENABLED=true and configure endpoints',
    });
    return;
  }

  const parsed = publishBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const result = await publishRacoWebhookEvent({
      type: parsed.data.type,
      data: parsed.data.data,
      config,
    });
    res.status(202).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'publish_failed';
    res.status(400).json({ error: message });
  }
});

app.post('/v1/deliveries/test', async (req, res) => {
  if (!config.enabled) {
    res.status(503).json({ error: 'webhooks_disabled' });
    return;
  }
  const envelope = createWebhookEnvelope({
    type: 'raco.ping',
    data: { source: 'raco-webhooks/test', ...(req.body || {}) },
  });
  const result = await deliverRacoWebhookEvent({ envelope, config });
  res.status(202).json(result);
});

if (require.main === module) {
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[raco-webhooks] listening on :${config.port} enabled=${config.enabled} endpoints=${config.endpoints.length}`,
    );
  });
}

export { app };
