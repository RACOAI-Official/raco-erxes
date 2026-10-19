# PROJECT_INVENTORY — Official erxes baseline

**Status:** Stage One inventory (source inspection complete; local runtime baseline not achieved)  
**Inspected:** 2026-10-19  
**Evidence mode:** Claims tagged `verified-from-source` or `inferred-from-docs`.

---

## 1. Official repository

| Item | Value | Evidence |
|------|-------|----------|
| Canonical repo URL | `https://github.com/erxes/erxes` | verified-from-source — [GitHub erxes/erxes](https://github.com/erxes/erxes), README clone instructions |
| Org | `erxes` | verified-from-source |
| Default branch | `main` | verified-from-source — clone `git remote` / GitHub API |
| Homepage | `https://erxes.io` | verified-from-source — repo metadata / README |
| Docs | `https://erxes.io/docs/introduction` | verified-from-source |
| Package name in monorepo | `erxes-next` | verified-from-source — `/package.json` `"name": "erxes-next"` at tag `3.3.2` |
| Related repo | `https://github.com/erxes/erxes-next` (exists; last push ~2026-01-31) | verified-from-source — GitHub API `erxes/erxes-next` |
| Docs clone path drift | [docs.erxes.io/local-setup](https://docs.erxes.io/local-setup) still says `git clone …/erxes-next.git` | verified-from-source — docs page; **prefer** `erxes/erxes` per README |

**Raco decision needed:** writable fork/mirror URL (see `DECISIONS.md`). No application git remote is linked to this Project yet.

---

## 2. Version / commit inspected

| Item | Value | Evidence |
|------|-------|----------|
| Recommended pin for Raco work | **tag `3.3.2`** | verified-from-source — `git rev-parse 3.3.2` → `b5737b8f9a6f3d229cf63081569bfebc7196a29c`; `package.json` `"version": "3.3.2"` |
| Tag commit message | `release 3.3.2` (2026-10-18) | verified-from-source — `git log -1 3.3.2` |
| GitHub Releases “latest” at inspect time | tag **`3.3.1`** published 2026-10-18 | verified-from-source — GitHub Releases API; tag `3.3.2` exists on repo but was not the API `releases/latest` object |
| Shallow clone initially on `main` | `8b3c282997d273a9aebc17eaf2f28e37e44425e7` | verified-from-source — post-clone HEAD before checkout |
| Upstream guidance | “always using the latest version” | inferred-from-docs — README closing recommendation |

**Local clone path (ephemeral VM):** `/tmp/erxes-inspect/erxes` (depth-1 + tags fetch; not a Raco writable remote).

---

## 3. Recommended install paths

### 3.1 Local development (primary for engineering)

**Source of truth preference:** Repository README + in-tree scripts (verified-from-source). Cross-check docs site (some drift).

Prerequisites (README):

- Node.js 18+
- pnpm ≥ 8 (root declares `packageManager`: `pnpm@9.12.3`)
- MongoDB on `27017`
- Redis on `6379`

Steps (README):

```bash
git clone https://github.com/erxes/erxes.git
cd erxes
pnpm install
cp .env.example .env   # NOTE: tree at 3.3.2 has `.env.sample`, not `.env.example`
pnpm dev:core-api      # or pnpm dev:apis
pnpm dev:uis           # separate terminal
```

Access: UI `http://localhost:3001` (README / docs).

**Docs site additions** ([docs.erxes.io/local-setup](https://docs.erxes.io/local-setup)):

- Node.js **v20+**, pnpm, nx, nvm, Docker + Compose for Mongo/Redis
- Example Compose uses `mongo:4.0.10` + `redis`
- Env: `MONGO_URL`, `REDIS_URL`, `NODE_OPTIONS=--max-old-space-size=1536`, optional `ENABLED_PLUGINS`
- Ports: UI 3001, gateway 4000, core 3300

**Inventory note:** At tag `3.3.2`, env template file is **`.env.sample`** (verified-from-source). README/`docs` still name `.env.example` — treat as doc drift.

### 3.2 Self-hosting / production-style

- Guide: [docs.erxes.io/self-hosting](https://docs.erxes.io/self-hosting)
- Requires Docker + Docker Compose + Nginx; Docker Swarm stack deploy; Mongo replica set; Redis
- System requirements stated: ≥2GB RAM, ≥10GB disk, Ubuntu or CentOS (inferred-from-docs — self-hosting page)
- Per-service Dockerfiles exist under `backend/`, `frontend/core-ui`, `apps/` (verified-from-source — filesystem listing)

---

## 4. Stack summary

| Layer | Stack | Evidence |
|-------|-------|----------|
| Monorepo | Nx `20.0.8`, pnpm workspaces (`backend/**`, `frontend/**`) | verified-from-source — `package.json`, `pnpm-workspace.yaml`, `nx.json` |
| Language | TypeScript `5.7.3` | verified-from-source — `package.json` |
| Runtime (CI) | Node.js **22** | verified-from-source — `.github/workflows/ci-*.yml` `node-version: '22'` |
| Backend | Express, Apollo Server v4, Federation/`@apollo/subgraph`, tRPC v11 | verified-from-source — README + docs introduction |
| Data | MongoDB + Mongoose `8.13.2`, Redis/`ioredis`, BullMQ | verified-from-source — `package.json` / docs |
| Frontend host | React `18.3.1`, Module Federation, Rspack, Tailwind CSS v4, Jotai | verified-from-source — docs introduction / `package.json` |
| Design system | `frontend/libs/erxes-ui` (AGPL-3.0-only in its `package.json`) | verified-from-source |
| Standalone apps | Next.js portals/help-center/POS; widgets Rspack | verified-from-source — docs introduction table |
| Auth extras | JWT; WorkOS SSO dependency present | verified-from-source — docs + `@workos-inc/node` in root deps |

Architecture detail: see `ARCHITECTURE.md`.

---

## 5. Repository layout (tag `3.3.2`)

```
erxes/
├── backend/           # gateway, core-api, erxes-api-shared, plugins/*, services/*, saas-migrations
├── frontend/          # core-ui, libs (erxes-ui, ui-modules), plugins/*
├── apps/              # client-portal-template, help-center, posclient-front, frontline-widgets
├── scripts/           # create-plugin, start-api-dev, start-ui-dev
├── cloudflare/        # mail worker
├── docs/              # sparse in-tree docs (e.g. mutation guides)
├── LICENSE.md
├── package.json       # name erxes-next, version 3.3.2
└── .env.sample
```

**Backend plugins present:** `accounting_api`, `content_api`, `frontline_api`, `insurance_api`, `loyalty_api`, `mongolian_api`, `operation_api`, `payment_api`, `posclient_api`, `sales_api`, `tourism_api`  
**Frontend plugins present:** matching `*_ui` plus `mastra_ui`  
**Background services:** `automations`, `logs`  
**No `ee/` directory** at tag `3.3.2` despite LICENSE.md still referencing `ee/LICENSE` and `…/tree/master/ee` (verified-from-source).

---

## 6. Licence / NOTICE inventory pointers

| File / page | Present? | Notes |
|-------------|----------|-------|
| `LICENSE.md` (repo root) | Yes | AGPLv3 body + SaaS competition restriction + EE pointer — see `LICENCE_REVIEW.md` |
| `NOTICE` | **No** | verified-from-source — `find` at tag `3.3.2` |
| `ee/LICENSE` | **Absent** (no `ee/` tree) | verified-from-source |
| Commercial pages | Platform / Infrastructure / Enterprise edition pricing on erxes.io | verified-from-source — marketing/pricing URLs |
| Root `package.json` `"license": "MIT"` | Present | **Conflicts** with LICENSE.md AGPLv3 / badge — open legal question |

---

## 7. Local baseline attempt (this VM)

| Check | Result |
|-------|--------|
| `git clone --depth 1 https://github.com/erxes/erxes.git` | **Succeeded** → `/tmp/erxes-inspect/erxes` |
| Checkout tag `3.3.2` | **Succeeded** (`b5737b8f…`) |
| Docker | **Missing** (`docker: command not found`) |
| Native MongoDB / Redis | **Missing** |
| Memory | ~15 GiB total, ~4.9 GiB available at inspect — likely insufficient for full `pnpm install` + multi-service `dev:apis`/`dev:uis` without risk |
| Runtime baseline (`pnpm install` + bring-up) | **Not claimed** — blocked on Docker/Mongo/Redis and resource headroom |

Exact blockers recorded in `PROJECT_STATUS.md` and `COMMERCIAL_LAUNCH_GATE.md` (engineering readiness ≠ commercial approval).

---

## 8. Built-in white-label surface (inventory only)

erxes already exposes organization white-label fields (`orgLogo`, `orgFavicon`, login copy, short name) under:

- `backend/core-api/src/modules/organization/whitelabel/` (verified-from-source)

Core UI reads `organization.orgLogo` / `orgFavicon` (e.g. `frontend/core-ui/src/modules/auth/components/Logo.tsx`, `OrganizationProvider.tsx`).

Production docs note plugin assets may load from `plugins.erxes.io` (verified-from-source — docs introduction; `organization/routes.ts` string).

---

## 9. Related documents

- `ARCHITECTURE.md`
- `ERXES_FEATURE_MATRIX.md`
- `DEPENDENCY_AND_VERSION_MATRIX.md`
- `LICENCE_REVIEW.md`
- `COMMERCIAL_LAUNCH_GATE.md`
- `IMPLEMENTATION_PLAN.md`
- `TARGET_ARCHITECTURE.md`
- `DECISIONS.md`
- `PROJECT_STATUS.md`
