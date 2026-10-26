import { createTransport } from 'nodemailer';
import { IMailcowConfig } from './config';
import { IMailTransport } from '@/integrations/mail/utils/transports/types';
import { readAttachmentBytes } from '@/integrations/mail/utils/attachments';
import {
  buildAutomationHeaders,
  MailSendError,
  toPlainText,
} from '@/integrations/mail/utils/transports/common';

export const createMailcowTransport = (
  subdomain: string,
  config: IMailcowConfig,
): IMailTransport => ({
  name: 'Mailcow SMTP',
  provider: 'custom',
  domain: config.address.split('@')[1],
  async send(input) {
    if (input.from.toLowerCase() !== config.address) {
      throw new MailSendError('Mailcow sender must match the configured mailbox', false);
    }
    if (input.reactionEmoji) {
      throw new MailSendError('Mailcow email reactions are not supported', false);
    }
    const attachments = await Promise.all((input.attachments ?? []).map(async (attachment) => {
      if (!attachment.url) throw new MailSendError('Attachment has no stored content', false);
      return {
        filename: attachment.name || 'attachment',
        content: await readAttachmentBytes(subdomain, attachment.url),
        contentType: attachment.type,
        cid: attachment.contentId,
        contentDisposition: attachment.disposition,
      };
    }));
    const smtp = createTransport({
      host: config.host, port: config.port, secure: config.port === 465,
      requireTLS: true, tls: { rejectUnauthorized: true, servername: config.host },
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 60000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    try {
      const result = await smtp.sendMail({
        from: { address: config.address, name: input.fromName || '' },
        // Thread via Message-ID; do not require Mailcow subaddressing.
        replyTo: config.address,
        to: input.to, cc: input.cc, bcc: input.bcc,
        subject: input.subject, html: input.html, text: toPlainText(input.html),
        messageId: input.messageId, inReplyTo: input.inReplyTo,
        references: input.references, headers: buildAutomationHeaders(input), attachments,
      });
      return {
        providerMessageId: result.messageId,
        delivered: [],
        bounced: result.rejected.map((entry) => typeof entry === 'string' ? entry : entry.address),
        queued: result.accepted.map((entry) => typeof entry === 'string' ? entry : entry.address),
      };
    } catch (error: unknown) {
      const responseCode = error && typeof error === 'object' && 'responseCode' in error
        ? Number(error.responseCode) : 0;
      throw new MailSendError('Mailcow SMTP delivery failed; check mailbox authentication and server logs',
        !responseCode || responseCode < 500);
    } finally {
      smtp.close();
    }
  },
});
