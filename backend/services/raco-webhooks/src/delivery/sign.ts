import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Sign payload the same way many inbound erxes webhooks verify:
 * HMAC-SHA256(secret, `${timestamp}.${rawBody}`).
 */
export function signRacoWebhookPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

export function buildSignedHeaders(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  eventType: string;
  deliveryId: string;
}): Record<string, string> {
  const signature = signRacoWebhookPayload(
    input.secret,
    input.timestamp,
    input.rawBody,
  );
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'raco-webhooks/0.1',
    'X-Raco-Event': input.eventType,
    'X-Raco-Delivery': input.deliveryId,
    'X-Raco-Timestamp': input.timestamp,
    'X-Raco-Signature': `sha256=${signature}`,
  };
}

export function verifyRacoWebhookSignature(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  signatureHeader: string;
}): boolean {
  const expected = `sha256=${signRacoWebhookPayload(
    input.secret,
    input.timestamp,
    input.rawBody,
  )}`;
  const provided = input.signatureHeader.trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
