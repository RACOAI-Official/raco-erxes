# DEPENDENCY_AND_VERSION_MATRIX

**Pinned inspection:** erxes tag **`3.3.2`** / commit **`b5737b8f9a6f3d229cf63081569bfebc7196a29c`**  
**Evidence:** root `package.json`, CI workflows, official docs — tagged per row.

---

## 1. Platform / toolchain

| Component | Declared / observed | Source | Notes |
|-----------|---------------------|--------|-------|
| erxes product version | `3.3.2` | `package.json` `"version"` | verified-from-source |
| Git tag | `3.3.2` | `git rev-parse` | Prefer over floating `main` for Raco pin |
| GitHub Release “latest” | `3.3.1` (at inspect) | Releases API | Tag `3.3.2` existed; release object lagged |
| Package manager | `pnpm@9.12.3` | `packageManager` field | verified-from-source; engines also say pnpm ≥8 |
| Nx | `20.0.8` | `package.json` / docs table | verified-from-source |
| TypeScript | `5.7.3` | `package.json` | verified-from-source |
| Node (README) | 18+ | README | verified-from-source |
| Node (docs local-setup) | v20+ | docs.erxes.io | inferred-from-docs / docs site |
| Node (CI) | **22** (some jobs `22.19.0`) | `.github/workflows/*` | verified-from-source — **recommend Node 22 for Raco** |
| npm / yarn | forbidden (`please-use-pnpm`) | `engines` | verified-from-source |

---

## 2. Runtime services

| Service | Dev expectation | Docs Compose image | Evidence |
|---------|-----------------|--------------------|----------|
| MongoDB | `localhost:27017` | `mongo:4.0.10` (local-setup) | README + docs — **note:** Mongoose 8 likely wants a newer Mongo; treat Compose sample as possibly stale |
| Redis | `6379` | `redis` (unpinned in sample) | README + docs |
| Elasticsearch | Mentioned in README stack table | Not required in Quick Start | inferred — optional/advanced |

---

## 3. Key application libraries (root `package.json` at 3.3.2)

| Library | Version | Role |
|---------|---------|------|
| `react` | `18.3.1` | Core UI |
| `mongoose` | `8.13.2` | Mongo ODM |
| `express` | `^4.21.2` | HTTP services |
| `graphql` | `^16.10.0` | API |
| `@apollo/server` | `^4.11.3` | GraphQL server |
| `@apollo/subgraph` | `^2.9.3` | Federation |
| `@trpc/server` / `@trpc/client` | `^11.0.0` | Service RPC |
| `bullmq` | `^5.40.0` | Queues |
| `@workos-inc/node` | `^7.65.0` | SSO |
| `@sentry/node` / `@sentry/react` | `^10.55.0` | Telemetry |

Full transitive set: `pnpm-lock.yaml` (present; not exhaustively tabulated here).

---

## 4. Frontend / apps (from official docs table)

| Surface | Framework versions (docs) | Evidence class |
|---------|---------------------------|----------------|
| Core UI | React 18.3.1, Rspack 1.0.5, MF enhanced 0.6.6 | verified-from-source (docs introduction) |
| `client-portal-template` | Next.js 16.0.3, React 19 | inferred-from-docs (confirm in app package on pin) |
| `help-center` | Next.js 16.3.2, React 19 | inferred-from-docs |
| `posclient-front` | Next.js 14, React 18 | inferred-from-docs |

---

## 5. Container / deploy artifacts

| Artifact | Location | Evidence |
|----------|----------|----------|
| Service Dockerfiles | `backend/**/Dockerfile`, `frontend/core-ui/Dockerfile`, `apps/**/Dockerfile` | verified-from-source listing |
| Official Docker Hub | Badge `erxes/erxes` pulls on README | verified-from-source badge; image tags not audited this pass |

---

## 6. Raco environment recommendations (engineering draft)

| Decision | Recommendation | Status |
|----------|----------------|--------|
| Upstream pin | `3.3.2` (`b5737b8f…`) until first Raco fork | Proposed — needs DECISION |
| Node | 22.x LTS matching CI | Proposed |
| pnpm | 9.12.3 via `packageManager` | Proposed |
| Mongo | Compatible with Mongoose 8 (verify against erxes self-host compose generator; do not blindly use docs’ 4.0.10 long-term) | Open |
| Redis | 7.x current stable unless upstream compose pins otherwise | Open |

---

## 7. Licence metadata inconsistency (dependency hygiene)

| Location | Field | Value |
|----------|-------|-------|
| Root `package.json` | `license` | `MIT` |
| `LICENSE.md` | Body | AGPLv3 + restrictions |
| `backend/erxes-api-shared/package.json` | `license` | `AGPL-3.0-only` |
| `frontend/libs/erxes-ui/package.json` | `license` | `AGPL-3.0-only` |
| `backend/gateway` / `core-api` package.json | `license` | `ISC` |

Treat SPDX fields as **unreliable** vs `LICENSE.md` until counsel reviews (`LICENCE_REVIEW.md`).
