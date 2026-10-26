import { getSaasConfig, signupSchema, verifySchema } from '../config';

describe('Self-service SaaS configuration', () => {
  afterEach(() => { for (const key of ['RACO_SAAS_PLANS', 'RACO_SAAS_DOMAIN', 'RACO_SSL_ENABLED', 'RACO_SSL_MODE', 'RACO_SSL_STORE_ID', 'RACO_SSL_STORE_PASSWORD', 'RACO_SSL_ALLOW_LIVE']) delete process.env[key]; });
  it('uses the approved domain, 14-day trial and disabled checkout', () => {
    expect(getSaasConfig()).toMatchObject({ domain: 'xos.racoai.io', trialDays: 14, checkoutEnabled: false });
    expect(getSaasConfig().plans[0].monthlyPrice).toBeNull();
  });
  it('accepts operator configured prices without enabling checkout', () => {
    process.env.RACO_SAAS_PLANS = JSON.stringify([{ id: 'business', name: 'Business', description: 'Business CRM', monthlyPrice: 25, yearlyPrice: 250, currency: 'BDT', seats: 10, features: [] }]);
    expect(getSaasConfig().plans[0].monthlyPrice).toBe(25);
    expect(getSaasConfig().checkoutEnabled).toBe(false);
  });
  it('requires credentials, explicit enabling and priced plans before checkout opens', () => {
    Object.assign(process.env, { RACO_SSL_ENABLED: 'true', RACO_SSL_STORE_ID: 'test', RACO_SSL_STORE_PASSWORD: 'private' });
    expect(getSaasConfig().checkoutEnabled).toBe(false);
    process.env.RACO_SAAS_PLANS = JSON.stringify([{ id: 'standard', name: 'Standard', description: 'CRM', monthlyPrice: 1000, yearlyPrice: 10000, currency: 'BDT', seats: 5, features: [] }]);
    expect(getSaasConfig().checkoutEnabled).toBe(true);
    process.env.RACO_SSL_MODE = 'live';
    expect(getSaasConfig().checkoutEnabled).toBe(false);
    process.env.RACO_SSL_ALLOW_LIVE = 'true';
    expect(getSaasConfig().checkoutEnabled).toBe(true);
  });
  it.each(['admin', 'www', '../company', 'company.example', 'aa', '-company'])('rejects reserved or invalid workspace %s', workspace => {
    expect(signupSchema.safeParse({ company: 'Company', email: 'owner@example.com', workspace, planId: 'standard' }).success).toBe(false);
  });
  it('requires a strong password and an opaque verification token', () => {
    expect(verifySchema.safeParse({ token: 'guess', firstName: 'Owner', password: 'short' }).success).toBe(false);
    expect(verifySchema.safeParse({ token: 'a'.repeat(64), firstName: 'Owner', password: 'StrongPassword123' }).success).toBe(true);
  });
});
