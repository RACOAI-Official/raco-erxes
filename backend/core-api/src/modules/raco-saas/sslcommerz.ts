import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const sslSettings = () => {
  const mode = z.enum(['sandbox', 'live']).parse(process.env.RACO_SSL_MODE || 'sandbox');
  const storeId = process.env.RACO_SSL_STORE_ID || '';
  const password = process.env.RACO_SSL_STORE_PASSWORD || '';
  const enabled = process.env.RACO_SSL_ENABLED === 'true' && !!storeId && !!password &&
    (mode === 'sandbox' || process.env.RACO_SSL_ALLOW_LIVE === 'true');
  return { mode, storeId, password, enabled,
    origin: mode === 'live' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com' };
};

export const amountToPoisha = (value: string | number) => {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Invalid BDT amount');
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('Invalid BDT amount');
  return result;
};

const md5 = (value: string) => createHash('md5').update(value).digest('hex');
export const verifySslSignature = (input: Record<string, string>, password: string) => {
  if (!/^[a-f0-9]{32}$/i.test(input.verify_sign || '')) return false;
  const keys = (input.verify_key || '').split(',').filter(Boolean);
  const required = ['tran_id', 'status', 'amount', 'currency', 'store_id'];
  if (['VALID', 'VALIDATED'].includes(input.status)) required.push('val_id');
  if (!required.every(key => keys.includes(key))) return false;
  if (keys.some(key => !/^[a-z_]+$/.test(key) || typeof input[key] !== 'string')) return false;
  const values: Record<string, string> = Object.fromEntries(keys.map(key => [key, input[key]]));
  values.store_passwd = md5(password);
  const expected = md5(Object.keys(values).sort().map(key => `${key}=${values[key]}`).join('&'));
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(input.verify_sign, 'hex'));
};

const sessionSchema = z.object({ status: z.literal('SUCCESS'), sessionkey: z.string().min(1), GatewayPageURL: z.string().url() });
const validationSchema = z.object({ status: z.string(), tran_id: z.string(), val_id: z.string(),
  amount: z.union([z.string(), z.number()]), currency: z.string(),
  risk_level: z.union([z.string(), z.number()]).optional(), bank_tran_id: z.string().optional(),
  store_id: z.string().optional() });
export type SslValidation = z.infer<typeof validationSchema>;

export const createSslSession = async (parameters: Record<string, string>, request: typeof fetch = fetch) => {
  const settings = sslSettings();
  if (!settings.enabled) throw new Error('SSLCommerz is not connected');
  const response = await request(`${settings.origin}/gwprocess/v4/api.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'error',
    body: new URLSearchParams({ ...parameters, store_id: settings.storeId, store_passwd: settings.password }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('SSLCommerz checkout could not be initialized');
  const session = sessionSchema.parse(await response.json());
  const url = new URL(session.GatewayPageURL);
  const allowed = settings.mode === 'live' ? ['securepay.sslcommerz.com'] : ['sandbox.sslcommerz.com', 'sandbox-gw.sslcommerz.com'];
  if (url.protocol !== 'https:' || !allowed.includes(url.hostname) || url.username || url.password || url.port) throw new Error('Invalid SSLCommerz checkout destination');
  return session;
};

export const validateSslPayment = async (validationId: string, request: typeof fetch = fetch) => {
  const settings = sslSettings();
  if (!settings.enabled) throw new Error('SSLCommerz is not connected');
  const url = new URL('/validator/api/validationserverAPI.php', settings.origin);
  url.search = new URLSearchParams({ val_id: validationId, store_id: settings.storeId,
    store_passwd: settings.password, format: 'json', v: '1' }).toString();
  const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('SSLCommerz validation is unavailable');
  return validationSchema.parse(await response.json());
};
