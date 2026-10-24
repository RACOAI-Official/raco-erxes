import { createHash } from 'node:crypto';
import { amountToPoisha, createSslSession, validateSslPayment, verifySslSignature } from '../sslcommerz';

describe('SSLCommerz payment boundary', () => {
  beforeEach(() => Object.assign(process.env, { RACO_SSL_ENABLED: 'true', RACO_SSL_MODE: 'sandbox', RACO_SSL_STORE_ID: 'test', RACO_SSL_STORE_PASSWORD: 'private' }));
  afterEach(() => { for (const key of ['RACO_SSL_ENABLED', 'RACO_SSL_MODE', 'RACO_SSL_STORE_ID', 'RACO_SSL_STORE_PASSWORD']) delete process.env[key]; });
  it('compares BDT using exact integer poisha', () => {
    expect(amountToPoisha('1000.10')).toBe(100010);
    expect(amountToPoisha(1000)).toBe(100000);
    for (const amount of ['1e3', '-10', '100.001', 'NaN', '0']) expect(() => amountToPoisha(amount)).toThrow();
  });
  it('verifies required signed fields and rejects tampering', () => {
    const values = { tran_id: 'rx_test', val_id: 'validation', status: 'VALID', amount: '1000.00', currency: 'BDT', store_id: 'test' };
    const md5 = (value: string) => createHash('md5').update(value).digest('hex');
    const signed = { ...values, store_passwd: md5('private') };
    const signature = md5(Object.entries(signed).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&'));
    const notification = { ...values, verify_key: Object.keys(values).join(','), verify_sign: signature };
    expect(verifySslSignature(notification, 'private')).toBe(true);
    expect(verifySslSignature({ ...notification, amount: '1.00' }, 'private')).toBe(false);
    expect(verifySslSignature({ ...notification, verify_key: 'status' }, 'private')).toBe(false);
  });
  it('rejects a checkout URL outside the selected provider environment', async () => {
    const request = jest.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'SUCCESS', sessionkey: 'session', GatewayPageURL: 'https://attacker.example/checkout' })));
    await expect(createSslSession({ tran_id: 'test' }, request)).rejects.toThrow('destination');
    expect(request).toHaveBeenCalledWith('https://sandbox.sslcommerz.com/gwprocess/v4/api.php', expect.objectContaining({ redirect: 'error' }));
  });
  it('uses the authenticated validation endpoint and disables redirects', async () => {
    const request = jest.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'VALID', tran_id: 'test', val_id: 'value', amount: '10.00', currency: 'BDT', risk_level: '0' })));
    await validateSslPayment('value', request);
    const [url, options] = request.mock.calls[0];
    expect(url.origin).toBe('https://sandbox.sslcommerz.com');
    expect(url.searchParams.get('val_id')).toBe('value');
    expect(options.redirect).toBe('error');
  });
});
