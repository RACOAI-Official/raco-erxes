# BRANDING_GUIDE — Raco AI on erxes

**Status:** Scaffold / draft  
**Licence gate:** `COMMERCIAL_LAUNCH_GATE.md` remains **NOT APPROVED**  
**Code:** `backend/services/raco-brand`

---

## 1. Principles

1. Prefer **central config** (`raco-brand`) + existing erxes **OrgWhiteLabel** over scattered core forks.  
2. Do **not** invent legal/support emails or official logos.  
3. Do **not** claim customer-facing rebrand rights until G5 (trademark) closes.  
4. Preserve erxes copyright, `LICENSE.md`, and attribution.  
5. Website reference: **https://racoai.io**

---

## 2. Central config (`raco-brand`)

| Field | Default | Notes |
|-------|---------|-------|
| `companyName` | Raco AI | Overridable via `RACO_COMPANY_NAME` |
| `assets.websiteUrl` | https://racoai.io | |
| `assets.logoUrl` | `null` | Set `RACO_LOGO_URL` when assets exist |
| `assets.faviconUrl` | `null` | Set `RACO_FAVICON_URL` when assets exist |
| `assets.supportEmail` | `null` | **Do not invent** — set `RACO_SUPPORT_EMAIL` later |
| `assets.legalEmail` | `null` | **Do not invent** — set `RACO_LEGAL_EMAIL` later |
| `applyCustomerFacingRebrand` | `false` | Requires explicit env + legal clearance |
| `orgWhiteLabel.enabled` | `false` | Requires `RACO_APPLY_CUSTOMER_FACING_REBRAND=true` **and** `RACO_ORG_WHITELABEL_ENABLED=true` |

Load via `loadRacoBrandConfig(process.env)`.

---

## 3. Mapping to erxes OrgWhiteLabel

Upstream singleton fields (verified-from-source):

- `orgLogo`, `orgFavicon`, `orgLoginText`, `orgLoginDescription`, `orgShortName`, `orgShortDescription`, `enabled`

Raco mapping lives in `RacoBrandConfig.orgWhiteLabel`. Keep `enabled: false` until G5 + brand pack.

---

## 4. Blocked UI brand removals (until G5)

Documented in config `blockedUiBrandRemovals`:

- Default erxes wordmarks/logos in Core UI chrome without OrgWhiteLabel + rights  
- Empty-state / onboarding illustrations embedding erxes trademarks  
- Email templates asserting Raco ownership of erxes marks  
- Public SaaS marketing implying erxes Inc. OEM approval  

**Allowed now:** internal docs, architecture diagrams, placeholder login copy in isolated config, engineering sandboxes.

---

## 5. Required Raco inputs (D007)

1. Logo SVG/PNG (official)  
2. Favicon  
3. Display name confirmation  
4. Support email  
5. Legal email / counsel contact  
6. Written trademark / white-label permission (closes G5)

---

## 6. Env reference (no secrets)

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
