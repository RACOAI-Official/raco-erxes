import {
  DEFAULT_RACO_BRAND_CONFIG,
  loadRacoBrandConfig,
  toOrgWhiteLabelPayload,
} from '../config';

describe('raco-brand config', () => {
  it('defaults to racoai.io with null emails and logos', () => {
    const config = loadRacoBrandConfig({});
    expect(config.assets.websiteUrl).toBe('https://racoai.io');
    expect(config.assets.supportEmail).toBeNull();
    expect(config.assets.legalEmail).toBeNull();
    expect(config.assets.logoUrl).toBeNull();
    expect(config.applyCustomerFacingRebrand).toBe(false);
    expect(config.orgWhiteLabel.enabled).toBe(false);
  });

  it('does not invent emails when env is empty string', () => {
    const config = loadRacoBrandConfig({
      RACO_SUPPORT_EMAIL: '   ',
      RACO_LEGAL_EMAIL: '',
    });
    expect(config.assets.supportEmail).toBeNull();
    expect(config.assets.legalEmail).toBeNull();
  });

  it('enables org white-label mapping only when both flags are set', () => {
    const config = loadRacoBrandConfig({
      RACO_APPLY_CUSTOMER_FACING_REBRAND: 'true',
      RACO_ORG_WHITELABEL_ENABLED: 'true',
      RACO_LOGO_URL: 'https://cdn.example/raco-logo.svg',
    });
    expect(config.applyCustomerFacingRebrand).toBe(true);
    expect(config.orgWhiteLabel.enabled).toBe(true);
    expect(config.orgWhiteLabel.orgLogo).toBe(
      'https://cdn.example/raco-logo.svg',
    );
  });

  it('keeps blocked UI brand removals documented', () => {
    expect(DEFAULT_RACO_BRAND_CONFIG.blockedUiBrandRemovals.length).toBeGreaterThan(
      0,
    );
  });

  it('exposes OrgWhiteLabel payload without inventing logos', () => {
    const payload = toOrgWhiteLabelPayload(loadRacoBrandConfig({}));
    expect(payload.enabled).toBe(false);
    expect(payload.orgLogo).toBeNull();
    expect(payload.orgShortName).toBe('Raco');
  });
});
