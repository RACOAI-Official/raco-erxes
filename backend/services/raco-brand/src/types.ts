/**
 * Central Raco AI brand configuration types.
 *
 * Placeholders only — do not invent legal/support emails or official logos.
 * Org-level white-label fields map to erxes `OrgWhiteLabel` when enabled.
 * Commercial trademark replacement of erxes marks requires D007 / G5 clearance.
 */

export type RacoBrandAssetStatus =
  | 'placeholder'
  | 'provided'
  | 'blocked_pending_rights';

export interface RacoBrandAssets {
  /** Public marketing site — verified product URL */
  websiteUrl: string;
  /**
   * Logo URL or path. Leave null until legal/brand assets are supplied.
   * Do not invent or commit faux "official" logos.
   */
  logoUrl: string | null;
  logoStatus: RacoBrandAssetStatus;
  faviconUrl: string | null;
  faviconStatus: RacoBrandAssetStatus;
  /**
   * Support / legal emails intentionally omitted until Raco provides them.
   * Never invent addresses.
   */
  supportEmail: string | null;
  legalEmail: string | null;
}

export interface RacoBrandCopy {
  productDisplayName: string;
  shortName: string;
  tagline: string;
  loginHeadline: string;
  loginDescription: string;
}

/**
 * Values that can hydrate erxes OrgWhiteLabel when `enabled` and rights allow.
 * Deep chrome removals of erxes marks remain blocked without G5.
 */
export interface RacoOrgWhiteLabelMapping {
  orgShortName: string;
  orgLoginText: string;
  orgLoginDescription: string;
  orgShortDescription: string;
  orgLogo: string | null;
  orgFavicon: string | null;
  enabled: boolean;
}

export interface RacoBrandConfig {
  companyName: string;
  brandCode: 'raco-ai';
  assets: RacoBrandAssets;
  copy: RacoBrandCopy;
  /**
   * When false, consumers must not apply Raco chrome over erxes marks in
   * customer-facing surfaces beyond scaffolded placeholders.
   */
  applyCustomerFacingRebrand: boolean;
  orgWhiteLabel: RacoOrgWhiteLabelMapping;
  /**
   * Documented UI brand removals that remain blocked without trademark rights.
   */
  blockedUiBrandRemovals: string[];
}
