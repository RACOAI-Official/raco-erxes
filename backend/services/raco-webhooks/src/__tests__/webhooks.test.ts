import {
  buildSignedHeaders,
  deliverRacoWebhookEvent,
  loadRacoWebhookConfig,
  publishRacoWebhookEvent,
  signRacoWebhookPayload,
  verifyRacoWebhookSignature,
  createWebhookEnvelope,
} from '../index';

describe('raco-webhooks', () => {
  it('loads disabled config by default', () => {
    const config = loadRacoWebhookConfig({});
    expect(config.enabled).toBe(false);
    expect(config.endpoints).toEqual([]);
  });

  it('parses endpoint JSON from env', () => {
    const config = loadRacoWebhookConfig({
      RACO_WEBHOOKS_ENABLED: 'true',
      RACO_WEBHOOK_SIGNING_SECRET: 'test-secret',
      RACO_WEBHOOK_ENDPOINTS_JSON: JSON.stringify([
        {
          id: 'partner-a',
          url: 'https://example.com/hooks/raco',
          events: ['customer.created', '*'],
          enabled: true,
        },
      ]),
    });
    expect(config.enabled).toBe(true);
    expect(config.endpoints).toHaveLength(1);
    expect(config.endpoints[0].events).toEqual(['*']);
  });

  it('signs and verifies HMAC payloads', () => {
    const secret = 'test-secret';
    const timestamp = '1710000000';
    const rawBody = '{"ok":true}';
    const signature = `sha256=${signRacoWebhookPayload(secret, timestamp, rawBody)}`;
    expect(
      verifyRacoWebhookSignature({
        secret,
        timestamp,
        rawBody,
        signatureHeader: signature,
      }),
    ).toBe(true);
    const headers = buildSignedHeaders({
      secret,
      timestamp,
      rawBody,
      eventType: 'raco.ping',
      deliveryId: 'd1',
    });
    expect(headers['X-Raco-Signature']).toBe(signature);
    expect(headers['X-Raco-Event']).toBe('raco.ping');
  });

  it('delivers with retries then succeeds', async () => {
    let calls = 0;
    const config = loadRacoWebhookConfig({
      RACO_WEBHOOKS_ENABLED: 'true',
      RACO_WEBHOOK_SIGNING_SECRET: 'test-secret',
      RACO_WEBHOOK_MAX_ATTEMPTS: '3',
      RACO_WEBHOOK_BASE_DELAY_MS: '1',
      RACO_WEBHOOK_ENDPOINTS_JSON: JSON.stringify([
        {
          id: 'partner-a',
          url: 'https://example.com/hooks/raco',
          events: ['raco.ping'],
          enabled: true,
        },
      ]),
    });
    const envelope = createWebhookEnvelope({
      type: 'raco.ping',
      data: { hello: 'world' },
    });
    const result = await deliverRacoWebhookEvent({
      envelope,
      config,
      deliverOnce: async () => {
        calls += 1;
        if (calls < 2) {
          return { ok: false, status: 500, error: 'HTTP 500' };
        }
        return { ok: true, status: 200 };
      },
    });
    expect(calls).toBe(2);
    expect(result.deliveries[0].ok).toBe(true);
    expect(result.deliveries[0].attempt).toBe(2);
  });

  it('rejects unknown event types on publish', async () => {
    await expect(
      publishRacoWebhookEvent({
        type: 'not.a.real.event',
        data: {},
        config: loadRacoWebhookConfig({ RACO_WEBHOOKS_ENABLED: 'true' }),
      }),
    ).rejects.toThrow(/unsupported_event/);
  });
});
