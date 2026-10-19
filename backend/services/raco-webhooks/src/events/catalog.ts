/**
 * Initial outbound event catalog for standalone Raco ↔ other-product integrations.
 * Prefer emitting these from adapters/plugins later; do not rebuild CRM here.
 */
export const RACO_WEBHOOK_EVENTS = [
  'raco.ping',
  'customer.created',
  'customer.updated',
  'company.created',
  'company.updated',
  'deal.created',
  'deal.updated',
  'conversation.created',
  'conversation.message.created',
  'ticket.created',
  'ticket.updated',
] as const;

export type RacoWebhookEventName = (typeof RACO_WEBHOOK_EVENTS)[number];

export function isRacoWebhookEventName(
  value: string,
): value is RacoWebhookEventName {
  return (RACO_WEBHOOK_EVENTS as readonly string[]).includes(value);
}
