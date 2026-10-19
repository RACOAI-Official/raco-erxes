# ERXES_FEATURE_MATRIX

**Baseline:** tag `3.3.2` (`b5737b8f…`) + official docs/README  
**Legend:** CE = Community / public tree · EE = marketed as Enterprise-only · SaaS = env/`VERSION=saas` paths  
**Tags:** `verified-from-source` | `inferred-from-docs`

---

## 1. Core platform (ships with Core API / Core UI)

| Capability | In public tree | Notes | Evidence |
|------------|----------------|-------|----------|
| Contacts / customers | Yes | Core modules | README Core list; `core-api/src/modules/contacts` |
| Products | Yes | | README; `modules/products` |
| Segments | Yes | | README; `modules/segments` |
| Documents | Yes | | README; `modules/documents` |
| Automations | Yes | Needs `services/automations` process | README; `backend/services/automations` |
| Permissions | Yes | | docs introduction; `modules/permissions` |
| Properties / tags / forms | Yes | | `modules/properties`, `tags`, `forms` |
| Brands (CRM brand entities) | Yes | Workspace Brands pages | `frontend/.../BrandsPage.tsx` |
| Organization settings | Yes | | `modules/organization` |
| Org white-label (logo, favicon, login copy) | Yes | First-party schema | `organization/whitelabel` |
| Broadcast / email templates | Yes | | modules listing |
| Client portal hooks | Yes | | `modules/clientportal` |
| Import/export | Yes | | `modules/import-export` |
| Notifications / logs / search | Yes | Logs service for undo journal | modules + `.env.sample` |

---

## 2. Plugins in public monorepo (tag `3.3.2`)

| Plugin | Backend | Frontend | README EE badge? | Matrix note |
|--------|---------|----------|------------------|-------------|
| Frontline | `frontline_api` | `frontline_ui` | No (CE described) | Omnichannel / tickets — verified-from-source tree + README |
| Operation | `operation_api` | `operation_ui` | No | Tasks / cycles — verified-from-source |
| Sales | `sales_api` | `sales_ui` | No | Pipeline / deals — verified-from-source |
| Content | `content_api` | `content_ui` | **Yes — EE Only badge** | Code is in public tree; commercial use of EE-marked plugins needs legal confirmation — verified-from-source tree vs README badge |
| Accounting | `accounting_api` | `accounting_ui` | **Yes — EE Only** | Same conflict: present in tree, marketed EE |
| Tourism | `tourism_api` | `tourism_ui` | **Yes — EE Only** | Same |
| Payment | `payment_api` | `payment_ui` | Not listed in README plugin bullets | Present in tree — verified-from-source |
| Loyalty | `loyalty_api` | `loyalty_ui` | Not in README bullets | Present in tree |
| Insurance | `insurance_api` | `insurance_ui` | Not in README bullets | Present in tree |
| Mongolian | `mongolian_api` | `mongolian_ui` | Not in README bullets | Regional; present in tree |
| POS client | `posclient_api` | (app `posclient-front`) | CE mentioned in docs introduction | verified-from-source docs + tree |
| Mastra UI | — | `mastra_ui` | — | Frontend-only remote in tree |
| Property / Team / Finance | **Not found** as dirs at 3.3.2 | — | README lists with EE badge | inferred: marketplace/EE — not in this tag’s plugin folders |

**Docs claim (Community Edition plugins):** sales, operations, frontline, content, POS (`posclient`) — [introduction](https://erxes.io/docs/introduction) — **verified-from-source** (docs). Note docs list Content as CE while README badges Content as EE Only — **conflict; legal must clarify**.

---

## 3. Standalone customer-facing apps

| Feature | App | Evidence |
|---------|-----|----------|
| Client portal | `apps/client-portal-template` | docs introduction |
| Help center | `apps/help-center` | docs introduction |
| Messenger / forms widgets | `apps/frontline-widgets` | docs introduction |
| POS front | `apps/posclient-front` | docs introduction |

---

## 4. SaaS / multi-tenant related capabilities

| Capability | Present? | Evidence |
|------------|----------|----------|
| `VERSION=saas` branching | Yes | Many API files; `.env.sample` |
| Subdomain → organization → per-tenant DB | Yes | `generate-models.ts` |
| `backend/saas-migrations` | Yes | tree + CI |
| SaaS welcome messenger integration IDs | Env sample only | `.env.sample` |
| Commercial right to host competing SaaS | **Not granted by AGPL text alone** | `LICENSE.md` restriction — see licence docs |

---

## 5. Raco AI product mapping (draft, non-binding)

| Raco goal (master brief) | erxes fit | Approach preference |
|--------------------------|-----------|---------------------|
| White-label CX/CRM/engagement SaaS | Core + Frontline + Sales + Operation | Brand via org white-label + theme; plugins over core forks |
| Plans / billing / usage | Partial (`payment_*` exists; no full Raco billing product) | Isolated billing service + metering — Stage 6 |
| LLM Gateway | Not a first-class erxes product module in inventory | Isolated gateway service — Stage 7 |
| Voice / Bangla | No verified API contract inventoried here | Block until contracts verified — Stage 8 |
| Multi-tenant | Upstream SaaS mode exists | Only after commercial licence gate |

---

## 6. Gaps / uncertainties

1. EE vs public-tree conflict for Content/Accounting/Tourism (and README-only Property/Team/Finance).  
2. Whether marketplace plugins beyond this monorepo are required for Raco MVP.  
3. Production dependency on `plugins.erxes.io` asset hosting.  
4. WorkOS / Cloudflare mail / SendGrid paths — credentials later; not required for inventory.
