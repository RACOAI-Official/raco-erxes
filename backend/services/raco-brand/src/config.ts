import type { RacoBrandConfig, RacoOrgWhiteLabelMapping } from './types';

/**
 * Default Raco brand config.
 *
 * - Website: https://racoai.io (product site)
 * - No invented legal/support emails
 * - No invented official logos — assets stay null / placeholder
 * - Customer-facing rebrand stays off until COMMERCIAL_LAUNCH_GATE G5 + D007
 */
export const DEFAULT_RACO_BRAND_CONFIG: RacoBrandConfig = {
  companyName: 'Raco AI',
  brandCode: 'raco-ai',
  assets: {
    websiteUrl: 'https://racoai.io',
    logoUrl: null,
    logoStatus: 'placeholder',
    faviconUrl: null,
    faviconStatus: 'placeholder',
    supportEmail: null,
    legalEmail: null,
  },
  copy: {
    productDisplayName: 'Raco AI',
    shortName: 'Raco',
    tagline: 'CX and engagement powered by erxes',
    loginHeadline: 'Raco AI',
    loginDescription:
      'Sign in to continue. Branding assets and support contacts are placeholders until Raco supplies them.',
  },
  applyCustomerFacingRebrand: false,
  orgWhiteLabel: {
    orgShortName: 'Raco',
    orgLoginText: 'Raco AI',
    orgLoginDescription:
      'Placeholder login copy. Enable only after trademark / white-label rights are confirmed.',
    orgShortDescription: 'Raco AI (erxes-based platform)',
    orgLogo: null,
    orgFavicon: null,
    /** Keep disabled until G5 + brand assets — scaffold mapping only */
    enabled: false,
  },
  blockedUiBrandRemovals: [
    'Default erxes wordmarks and logos in Core UI chrome without OrgWhiteLabel + G5',
    'Empty-state / onboarding illustrations that embed erxes trademarks',
    'Email templates that assert Raco ownership of erxes marks',
    'Public SaaS marketing that implies erxes Inc. OEM approval',
  ],
};

/**
 * Load brand config. Env overrides are limited to non-secret display fields.
 * Never invent emails or logo URLs from empty env.
 */
export function loadRacoBrandConfig(
  env: NodeJS.ProcessEnv = process.env,
): RacoBrandConfig {
  const displayName =
    env.RACO_PRODUCT_DISPLAY_NAME?.trim() ||
    DEFAULT_RACO_BRAND_CONFIG.copy.productDisplayName;
  const shortName =
    env.RACO_SHORT_NAME?.trim() || DEFAULT_RACO_BRAND_CONFIG.copy.shortName;
  const websiteUrl =
    env.RACO_WEBSITE_URL?.trim() ||
    DEFAULT_RACO_BRAND_CONFIG.assets.websiteUrl;

  const logoUrl = env.RACO_LOGO_URL?.trim() || null;
  const faviconUrl = env.RACO_FAVICON_URL?.trim() || null;
  const supportEmail = env.RACO_SUPPORT_EMAIL?.trim() || null;
  const legalEmail = env.RACO_LEGAL_EMAIL?.trim() || null;

  const applyCustomerFacingRebrand =
    env.RACO_APPLY_CUSTOMER_FACING_REBRAND === 'true';

  return {
    ...DEFAULT_RACO_BRAND_CONFIG,
    companyName:
      env.RACO_COMPANY_NAME?.trim() || DEFAULT_RACO_BRAND_CONFIG.companyName,
    assets: {
      websiteUrl,
      logoUrl,
      logoStatus: logoUrl ? 'provided' : 'placeholder',
      faviconUrl,
      faviconStatus: faviconUrl ? 'provided' : 'placeholder',
      supportEmail,
      legalEmail,
    },
    copy: {
      ...DEFAULT_RACO_BRAND_CONFIG.copy,
      productDisplayName: displayName,
      shortName,
      loginHeadline:
        env.RACO_LOGIN_HEADLINE?.trim() ||
        DEFAULT_RACO_BRAND_CONFIG.copy.loginHeadline,
      loginDescription:
        env.RACO_LOGIN_DESCRIPTION?.trim() ||
        DEFAULT_RACO_BRAND_CONFIG.copy.loginDescription,
    },
    applyCustomerFacingRebrand,
    orgWhiteLabel: {
      ...DEFAULT_RACO_BRAND_CONFIG.orgWhiteLabel,
      orgShortName: shortName,
      orgLoginText: displayName,
      orgLogo: logoUrl,
      orgFavicon: faviconUrl,
      enabled:
        applyCustomerFacingRebrand &&
        env.RACO_ORG_WHITELABEL_ENABLED === 'true',
    },
  };
}

/**
 * Payload aligned with erxes OrgWhiteLabel fields for upsert when rights + assets exist.
 * Does not invent logo URLs or enable the flag by itself.
 */
export function toOrgWhiteLabelPayload(
  config: RacoBrandConfig,
): RacoOrgWhiteLabelMapping {
  return { ...config.orgWhiteLabel };
}
