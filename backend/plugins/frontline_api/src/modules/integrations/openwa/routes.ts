import { generateModels } from '~/connectionResolvers';
import { composeOpenwaMessage } from './outbound';
import {
  isEmailApprovalCommand,
  processWhatsAppEmailApproval,
} from './emailApproval';
import { openwaId } from './contract';
import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import {
  getOpenwaConfig,
  openwaEnvelope,
  openwaMessage,
  verifyOpenwaSignature,
} from './contract';
import { receiveOpenwaMessage } from './service';
import { getOpenwaAiConfig, receiveOpenwaAiReply } from './aiReply';

export const openwaRouter: Router = Router();

// One server-managed integration: a shared budget also bounds invalid HMACs
// behind proxies without trusting client-controlled forwarded IP headers.
const webhookLimiter = rateLimit({
  windowMs: 60_000,
  limit: 240,
  keyGenerator: () => 'openwa',
  standardHeaders: true,
  legacyHeaders: false,
});

const handleWebhook =
  (aiReply: boolean) => async (req: Request, res: Response) => {
    if (aiReply && process.env.OPENWA_AI_ENABLED !== 'true') {
      res.status(503).json({ error: 'OpenWA AI replies are disabled' });
      return;
    }
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
      if (isEmailApprovalCommand(message.body)) {
        const id = await receiveOpenwaMessage(message, {
          emitAutomationTrigger: false,
        });
        if (!id) {
          res.status(200).json({ accepted: true, state: 'ignored' });
          return;
        }
        const models = await generateModels(config.subdomain);
        const state = await processWhatsAppEmailApproval(
          config.subdomain,
          models,
          message,
        );
        const conversationId = openwaId(
          'chat',
          config.integrationId,
          message.chatId,
        );
        const conversation = await models.Conversations.findOne({
          _id: conversationId,
          integrationId: config.integrationId,
        });
        const feedback = {
          ambiguous:
            'Several emails await approval. Use WhatsApp Reply on the email preview you want, then type APPROVE or REJECT. No code is needed.',
          approved:
            'Email approved and sent. You can check delivery in the CRM.',
          rejected:
            'Email rejected. It has NOT been sent. The draft remains available for editing.',
          invalid:
            'Approval is invalid, expired, changed, or not assigned to this phone. Request a new approval. Reply APPROVE or REJECT to its approval preview.',
          processing:
            'This approval is already being processed. Please check the CRM before retrying.',
          needs_review:
            'Email approval needs manual review. Delivery could not be confirmed; do not retry sending until you check the CRM.',
        }[state];
        if (conversation?.customerId)
          await composeOpenwaMessage(
            config.subdomain,
            {
              customerId: conversation.customerId,
              text: feedback,
              requestId: openwaId('email-approval-feedback', message.id, state),
            },
            { fromBot: true },
            { conversationId, chatId: message.chatId },
          );
        res
          .status(200)
          .json({ accepted: true, messageId: id, emailApproval: state });
        return;
      }
      if (aiReply) {
        getOpenwaAiConfig();
        const result = await receiveOpenwaAiReply(message);
        res.status(200).json({ accepted: true, ...result });
        return;
      }
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
  };

openwaRouter.post('/receive', webhookLimiter, handleWebhook(false));
openwaRouter.post('/ai-reply', webhookLimiter, handleWebhook(true));
