import { getEnv } from 'erxes-api-shared/utils';
import { isEmailAddress } from '@/integrations/mail/utils/address';

export interface IMailcowConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  address: string;
}

// A single operator-managed mailbox, scoped explicitly to one tenant.
export const readMailcowConfig = (subdomain: string): IMailcowConfig | null => {
  if (process.env.MAILCOW_SUBDOMAIN !== subdomain) return null;
  const read = (name: string) => getEnv({ name, defaultValue: '', subdomain });
  const host = read('MAILCOW_SMTP_HOST').trim();
  const user = read('MAILCOW_SMTP_USER').trim();
  const password = read('MAILCOW_SMTP_PASSWORD');
  const address = read('MAILCOW_ADDRESS').trim().toLowerCase();
  const port = Number(read('MAILCOW_SMTP_PORT') || '587');
  if (!host || !user || !password || !isEmailAddress(address)) return null;
  if (![465, 587].includes(port) || /[\s/]/.test(host)) {
    throw new Error('Mailcow requires a hostname and TLS SMTP port 465 or 587');
  }
  return { host, port, user, password, address };
};
