import { readFileSync } from 'fs';
import { z } from 'zod';
import { isRacoWebhookEventName } from '../events/catalog';
import type {
  RacoWebhookEndpointConfig,
  RacoWebhookRuntimeConfig,
} from './types';

const endpointSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()).default(['*']),
  enabled: z.boolean().default(true),
  signingSecretEnv: z.string().optional(),
});

const fileSchema = z.object({
  endpoints: z.array(endpointSchema).default([]),
});

function normalizeEvents(
  events: string[],
): RacoWebhookEndpointConfig['events'] {
  if (events.includes('*') || events.length === 0) {
    return ['*'];
  }
  const named = events.filter(isRacoWebhookEventName);
  return named.length > 0 ? (named as RacoWebhookEndpointConfig['events']) : ['*'];
}

function parseEndpointsJson(raw: string): RacoWebhookEndpointConfig[] {
  const parsed = JSON.parse(raw) as unknown;
  const list = Array.isArray(parsed) ? parsed : fileSchema.parse(parsed).endpoints;
  return z.array(endpointSchema).parse(list).map((endpoint) => ({
    ...endpoint,
    events: normalizeEvents(endpoint.events),
  }));
}

/**
 * Load webhook runtime config from env (+ optional JSON file/path).
 * Secrets stay in env — never invent or commit them.
 */
export function loadRacoWebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
): RacoWebhookRuntimeConfig {
  const enabled = env.RACO_WEBHOOKS_ENABLED === 'true';
  const signingSecret = env.RACO_WEBHOOK_SIGNING_SECRET?.trim() || null;

  let endpoints: RacoWebhookEndpointConfig[] = [];

  if (env.RACO_WEBHOOK_ENDPOINTS_JSON?.trim()) {
    endpoints = parseEndpointsJson(env.RACO_WEBHOOK_ENDPOINTS_JSON);
  } else if (env.RACO_WEBHOOK_ENDPOINTS_FILE?.trim()) {
    const fileRaw = readFileSync(env.RACO_WEBHOOK_ENDPOINTS_FILE, 'utf8');
    endpoints = parseEndpointsJson(fileRaw);
  }

  return {
    enabled,
    signingSecret,
    endpoints,
    maxAttempts: Number(env.RACO_WEBHOOK_MAX_ATTEMPTS || 5),
    baseDelayMs: Number(env.RACO_WEBHOOK_BASE_DELAY_MS || 500),
    requestTimeoutMs: Number(env.RACO_WEBHOOK_TIMEOUT_MS || 10000),
    port: Number(env.RACO_WEBHOOKS_PORT || 3391),
  };
}

export function resolveEndpointSecret(
  endpoint: RacoWebhookEndpointConfig,
  config: RacoWebhookRuntimeConfig,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (endpoint.signingSecretEnv) {
    return env[endpoint.signingSecretEnv]?.trim() || null;
  }
  return config.signingSecret;
}
