# BRANDING_GUIDE — Raco AI on erxes

**Status:** Scaffold + customer-facing surface audit  
**Product shape:** Standalone branded deployment of erxes — **not** a new SaaS CRM  
**Licence gate:** `COMMERCIAL_LAUNCH_GATE.md` remains **NOT APPROVED**  
**Code:** `backend/services/raco-brand`  
**Website:** https://racoai.io

---

## 1. Principles

1. Prefer **central config** (`raco-brand`) + existing erxes **OrgWhiteLabel** over scattered core forks.  
2. Do **not** invent legal/support emails or official logos.  
3. Do **not** claim customer-facing rebrand rights until G5 (trademark) closes.  
4. Preserve erxes copyright, `LICENSE.md`, and attribution — do not imply erxes endorses Raco AI.  
5. Do not rebuild erxes modules to rebrand them.

---

## 2. Central config (`raco-brand`)

| Field | Default | Notes |
|-------|---------|-------|
| `companyName` | Raco AI | `RACO_COMPANY_NAME` |
| `assets.websiteUrl` | https://racoai.io | |
| `assets.logoUrl` | `null` | Set `RACO_LOGO_URL` when assets exist |
| `assets.faviconUrl` | `null` | Set `RACO_FAVICON_URL` when assets exist |
| `assets.supportEmail` | `null` | **Do not invent** |
| `assets.legalEmail` | `null` | **Do not invent** |
| `applyCustomerFacingRebrand` | `false` | Explicit env + legal clearance |
| `orgWhiteLabel.enabled` | `false` | Needs both apply + `RACO_ORG_WHITELABEL_ENABLED=true` |

Load via `loadRacoBrandConfig(process.env)`.  
Helper: `toOrgWhiteLabelPayload(config)` → payload matching upstream OrgWhiteLabel fields.

---

## 3. Mapping to erxes OrgWhiteLabel (verified-from-source)

Upstream singleton (`backend/core-api/.../whitelabel`):

| Field | Consumed by |
|-------|-------------|
| `orgLogo` | `Logo.tsx` / `OrgLogoIcon` — replaces default erxes SVG wordmark when set |
| `orgFavicon` | `OrganizationProvider` — runtime `<link rel="icon">` |
| `orgLoginText` | `DynamicBanner` — login banner title |
| `orgLoginDescription` | Login copy (org white-label path) |
| `orgShortName` | `document.title` via `OrganizationProvider`; invitation UI fallback |
| `orgShortDescription` | Short org blurb |
| `enabled` | Merged into organization client config when true (`organization/routes.ts`) |

**Keep `enabled: false` until G5 + brand pack.**

---

## 4. Customer-facing surface audit (Core UI)

| Surface | Path / mechanism | Default erxes brand? | Raco path |
|---------|------------------|----------------------|-----------|
| HTML shell title | `frontend/core-ui/src/index.html` → `<title>erxes</title>` | Yes (static) | Runtime override via `orgShortName` after org load; static default remains until OrgWhiteLabel |
| Favicon | `index.html` → `/assets/erxes-logo.svg|.ico` | Yes | Runtime override via `orgFavicon` |
| Login logo | `auth/components/Logo.tsx` | Default erxes SVG paths when `orgLogo` missing | Supply `orgLogo` URL |
| Login banner title | `DynamicBanner.tsx` | i18n `banner-title` fallback | `orgLoginText` |
| Auth footer legal links | `AuthenticationLayout.tsx` → `erxes.io/legal/terms`, `.../privacy` | Yes (erxes.io) | **Blocked** — do not invent Raco legal URLs; replace only with verified destinations |
| Invitation short name | `ConfirmInvitationForm.tsx` | Fallback `'erxes'` | `orgShortName` |
| Email white-label | `core-api` email utils when `organization.isWhiteLabel` | erxes-oriented | Org white-label flags only when enabled |

### Notifications / emails / help links

- Prefer OrgWhiteLabel + existing email template variables.  
- Help/website links: only **https://racoai.io** or other **verified** destinations — no invented support domains.  
- Do not strip AGPL / copyright footers required by licence.

---

## 5. Blocked UI brand removals (until G5 + assets)

- Default erxes SVG wordmarks in `Logo.tsx` without a supplied `orgLogo`  
- Static `index.html` title/favicon before org config loads  
- Auth footer links to erxes.io legal pages (need Raco legal URLs from counsel)  
- Empty-state / onboarding illustrations embedding erxes trademarks  
- Email/marketing that asserts Raco ownership of erxes marks or erxes endorsement  

**Allowed now:** engineering placeholders in `raco-brand`, internal docs, OrgWhiteLabel mapping kept disabled.

---

## 6. How to apply branding when assets arrive

1. Place logo/favicon on a trusted CDN or local static host; set `RACO_LOGO_URL` / `RACO_FAVICON_URL`.  
2. Set display strings via env (`RACO_PRODUCT_DISPLAY_NAME`, `RACO_SHORT_NAME`, …).  
3. After counsel clears G5: set `RACO_APPLY_CUSTOMER_FACING_REBRAND=true` and `RACO_ORG_WHITELABEL_ENABLED=true`.  
4. Upsert OrgWhiteLabel via existing core-api organization white-label APIs / admin UI (payload from `toOrgWhiteLabelPayload`).  
5. Restart UI so favicon/title refresh; verify login, invite, and shell.

---

## 7. Required Raco inputs (D007)

1. Official logo SVG/PNG  
2. Favicon  
3. Display name confirmation  
4. Support email  
5. Legal email + verified terms/privacy URLs (to replace erxes.io footer links)  
6. Written trademark / white-label permission (closes G5)

---

## 8. Env reference (no secrets)

```bash
# RACO_COMPANY_NAME=Raco AI
# RACO_PRODUCT_DISPLAY_NAME=Raco AI
# RACO_SHORT_NAME=Raco
# RACO_WEBSITE_URL=https://racoai.io
# RACO_LOGO_URL=
# RACO_FAVICON_URL=
# RACO_SUPPORT_EMAIL=
# RACO_LEGAL_EMAIL=
# RACO_APPLY_CUSTOMER_FACING_REBRAND=false
# RACO_ORG_WHITELABEL_ENABLED=false
```
