import type { RacoWebhookEventName } from '../events/catalog';

export interface RacoWebhookEndpointConfig {
  /** Stable id for logs / admin lists */
  id: string;
  url: string;
  /** Empty list means all catalog events */
  events: RacoWebhookEventName[] | ['*'];
  enabled: boolean;
  /**
   * Optional per-endpoint secret override. Prefer the deployment-wide
   * `RACO_WEBHOOK_SIGNING_SECRET` env; never commit secrets.
   */
  signingSecretEnv?: string;
}

export interface RacoWebhookRuntimeConfig {
  enabled: boolean;
  /** Default HMAC secret from env — required when enabled and delivering */
  signingSecret: string | null;
  endpoints: RacoWebhookEndpointConfig[];
  maxAttempts: number;
  baseDelayMs: number;
  requestTimeoutMs: number;
  port: number;
}

export interface RacoWebhookEnvelope {
  id: string;
  type: RacoWebhookEventName;
  createdAt: string;
  /** Deployment identifier (not multi-tenant SaaS) */
  deployment: string;
  data: Record<string, unknown>;
}
