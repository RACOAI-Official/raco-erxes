import type {
  RacoWebhookEndpointConfig,
  RacoWebhookEnvelope,
  RacoWebhookRuntimeConfig,
} from '../config/types';
import { resolveEndpointSecret } from '../config/load';
import { buildSignedHeaders } from './sign';

export interface DeliveryAttemptResult {
  endpointId: string;
  url: string;
  attempt: number;
  ok: boolean;
  status?: number;
  error?: string;
}

export interface DeliveryResult {
  eventId: string;
  eventType: string;
  deliveries: DeliveryAttemptResult[];
}

function endpointMatches(
  endpoint: RacoWebhookEndpointConfig,
  eventType: string,
): boolean {
  if (!endpoint.enabled) {
    return false;
  }
  if (endpoint.events.includes('*' as never)) {
    return true;
  }
  return (endpoint.events as string[]).includes(eventType);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(input: {
  url: string;
  headers: Record<string, string>;
  rawBody: string;
  timeoutMs: number;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(input.url, {
      method: 'POST',
      headers: input.headers,
      body: input.rawBody,
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network_error';
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deliver an envelope to all matching endpoints with retries + HMAC headers.
 */
export async function deliverRacoWebhookEvent(input: {
  envelope: RacoWebhookEnvelope;
  config: RacoWebhookRuntimeConfig;
  env?: NodeJS.ProcessEnv;
  /** Injected fetch for tests — defaults to real deliverer */
  deliverOnce?: typeof postOnce;
}): Promise<DeliveryResult> {
  const env = input.env || process.env;
  const deliverOnce = input.deliverOnce || postOnce;
  const rawBody = JSON.stringify(input.envelope);
  const deliveries: DeliveryAttemptResult[] = [];

  if (!input.config.enabled) {
    return {
      eventId: input.envelope.id,
      eventType: input.envelope.type,
      deliveries: [],
    };
  }

  const targets = input.config.endpoints.filter((endpoint) =>
    endpointMatches(endpoint, input.envelope.type),
  );

  for (const endpoint of targets) {
    const secret = resolveEndpointSecret(endpoint, input.config, env);
    if (!secret) {
      deliveries.push({
        endpointId: endpoint.id,
        url: endpoint.url,
        attempt: 0,
        ok: false,
        error: 'missing_signing_secret',
      });
      continue;
    }

    let last: DeliveryAttemptResult | null = null;
    for (let attempt = 1; attempt <= input.config.maxAttempts; attempt += 1) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const deliveryId = `${input.envelope.id}:${endpoint.id}:${attempt}`;
      const headers = buildSignedHeaders({
        secret,
        timestamp,
        rawBody,
        eventType: input.envelope.type,
        deliveryId,
      });
      const result = await deliverOnce({
        url: endpoint.url,
        headers,
        rawBody,
        timeoutMs: input.config.requestTimeoutMs,
      });
      last = {
        endpointId: endpoint.id,
        url: endpoint.url,
        attempt,
        ok: result.ok,
        status: result.status,
        error: result.error,
      };
      if (result.ok) {
        break;
      }
      if (attempt < input.config.maxAttempts) {
        await sleep(input.config.baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
    if (last) {
      deliveries.push(last);
    }
  }

  return {
    eventId: input.envelope.id,
    eventType: input.envelope.type,
    deliveries,
  };
}
