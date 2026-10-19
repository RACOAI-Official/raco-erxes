import { randomUUID } from 'crypto';
import { loadRacoWebhookConfig } from './config/load';
import type { RacoWebhookEnvelope, RacoWebhookRuntimeConfig } from './config/types';
import {
  deliverRacoWebhookEvent,
  type DeliveryResult,
} from './delivery/deliver';
import {
  isRacoWebhookEventName,
  type RacoWebhookEventName,
} from './events/catalog';

export function createWebhookEnvelope(input: {
  type: RacoWebhookEventName;
  data: Record<string, unknown>;
  deployment?: string;
  id?: string;
  createdAt?: string;
}): RacoWebhookEnvelope {
  return {
    id: input.id || randomUUID(),
    type: input.type,
    createdAt: input.createdAt || new Date().toISOString(),
    deployment: input.deployment || process.env.RACO_DEPLOYMENT_ID || 'standalone',
    data: input.data,
  };
}

export async function publishRacoWebhookEvent(input: {
  type: string;
  data: Record<string, unknown>;
  config?: RacoWebhookRuntimeConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<DeliveryResult> {
  if (!isRacoWebhookEventName(input.type)) {
    throw new Error(`unsupported_event:${input.type}`);
  }
  const config = input.config || loadRacoWebhookConfig(input.env);
  const envelope = createWebhookEnvelope({
    type: input.type,
    data: input.data,
  });
  return deliverRacoWebhookEvent({
    envelope,
    config,
    env: input.env,
  });
}
