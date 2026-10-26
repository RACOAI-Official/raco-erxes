import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const openwaEnvelope = z.object({
  event: z.string(),
  sessionId: z.string().min(1),
  timestamp: z.string().datetime(),
  data: z.unknown(),
});

export const openwaMessage = z.object({
  id: z.string().min(1).max(512),
  chatId: z.string().min(1).max(256),
  from: z.string().min(1).max(256),
  body: z.string().max(65536).default(''),
  type: z.string().max(64),
  timestamp: z.number().finite().positive(),
  fromMe: z.boolean(),
  isGroup: z.boolean(),
  isStatusBroadcast: z.boolean().optional(),
  senderPhone: z.string().nullable().optional(),
  contact: z
    .object({
      name: z.string().max(256).optional(),
      pushName: z.string().max(256).optional(),
      number: z.string().max(64).optional(),
    })
    .optional(),
});

export type OpenwaMessage = z.infer<typeof openwaMessage>;

export const openwaId = (...parts: string[]): string =>
  `openwa-${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;

export const verifyOpenwaSignature = (
  raw: Buffer,
  signature: string | undefined,
  secret: string,
): boolean => {
  if (
    secret.length < 16 ||
    !signature ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
};

export const openwaPhone = (message: OpenwaMessage): string | undefined => {
  // A WhatsApp privacy ID (@lid) is never a telephone number.
  const candidate =
    message.senderPhone ||
    (/^\d+@(c\.us|s\.whatsapp\.net)$/.test(message.from)
      ? message.from.split('@')[0]
      : undefined);
  const digits = candidate?.replace(/^\+/, '');
  return digits && /^\d{7,15}$/.test(digits) ? `+${digits}` : undefined;
};

export const openwaHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>');

export const getOpenwaConfig = () => {
  const config = z
    .object({
      baseUrl: z.string().url(),
      apiKey: z.string().min(1),
      sessionId: z.string().min(1),
      integrationId: z.string().min(1),
      subdomain: z.string().min(1),
      secret: z.string().min(16),
    })
    .parse({
      baseUrl: process.env.OPENWA_BASE_URL,
      apiKey: process.env.OPENWA_API_KEY,
      sessionId: process.env.OPENWA_SESSION_ID,
      integrationId: process.env.OPENWA_INTEGRATION_ID,
      subdomain: process.env.OPENWA_SUBDOMAIN,
      secret: process.env.OPENWA_WEBHOOK_SECRET,
    });
  const url = new URL(config.baseUrl);
  if (
    url.username ||
    url.password ||
    !['http:', 'https:'].includes(url.protocol)
  )
    throw new Error('Invalid OpenWA server URL');
  return config;
};
