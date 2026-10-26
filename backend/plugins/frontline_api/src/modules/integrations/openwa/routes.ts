import { Router } from 'express';
import type { Request } from 'express';
import { ZodError } from 'zod';
import {
  getOpenwaConfig,
  openwaEnvelope,
  openwaMessage,
  verifyOpenwaSignature,
} from './contract';
import { receiveOpenwaMessage } from './service';

export const openwaRouter: Router = Router();

openwaRouter.post('/receive', async (req: Request, res) => {
  let config: ReturnType<typeof getOpenwaConfig>;
  try {
    config = getOpenwaConfig();
  } catch {
    res.status(503).json({ error: 'OpenWA integration is not configured' });
    return;
  }
  const rawBody: unknown = (req as Request & { rawBody?: unknown }).rawBody;
  if (
    !Buffer.isBuffer(rawBody) ||
    !verifyOpenwaSignature(
      rawBody,
      req.get('X-OpenWA-Signature'),
      config.secret,
    )
  ) {
    res.sendStatus(401);
    return;
  }
  try {
    const envelope = openwaEnvelope.parse(req.body);
    if (envelope.sessionId !== config.sessionId) {
      res.sendStatus(403);
      return;
    }
    // Authenticate test probes too; unsupported events never create contacts.
    if (envelope.event !== 'message.received') {
      res.sendStatus(204);
      return;
    }
    const message = openwaMessage.parse(envelope.data);
    const id = await receiveOpenwaMessage(message);
    res.status(200).json({ accepted: true, messageId: id });
  } catch (error: unknown) {
    res.status(error instanceof ZodError ? 400 : 503).json({
      error:
        error instanceof ZodError
          ? 'Invalid OpenWA event'
          : 'Processing failed; retry delivery',
    });
  }
});
