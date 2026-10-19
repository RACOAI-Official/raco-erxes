# BASELINE_RUN — Stage One evidence (fork pin 3.3.2)

**Date:** 2026-10-19  
**Commit:** `b5737b8f9a6f3d229cf63081569bfebc7196a29c` (tag `3.3.2`)  
**Fork:** `https://github.com/razin0900/https-github.com-razin0900-erxes`  
**Product shape:** standalone / self-hosted (SaaS out of scope).  
**Commercial gate:** **NOT APPROVED** — this is not production readiness.

---

## Toolchain

| Tool | Version |
|------|---------|
| Node | v22.23.3 |
| pnpm | 9.12.3 |
| Docker | **not installed** on this VM |

---

## Data stores

| Store | How | Result |
|-------|-----|--------|
| Redis 7 | `apt-get install redis-server`; `redis-server --daemonize yes` | `PONG` |
| MongoDB 7.0.14 | Official Ubuntu 22.04 tarball under `/tmp/mongodb` | Port 27017 open; core-api connected |

Official docs Compose path was blocked by missing Docker; native/tarball substitutes used.

---

## Commands and results

| Command | Result |
|---------|--------|
| `pnpm install` | Success (~40s) |
| `pnpm nx build erxes-api-shared` | Success |
| `pnpm nx build core-api` | Success |
| `pnpm nx build gateway` | Success |
| `pnpm nx test erxes-api-shared` | **37** suites / **328** tests passed (pre-existing mongoose duplicate-index + AWS SDK v2 maintenance warnings; worker teardown warning) |
| `pnpm nx run-many -t build -p raco-brand,raco-llm-gateway,raco-entitlements` | Success |
| `pnpm nx run-many -t test -p raco-brand,raco-llm-gateway,raco-entitlements` | **9** tests passed |
| `pnpm nx serve core-api` (45s smoke) | Connected to Mongo `mongodb://localhost:27017/erxes`; joined `http://localhost:3300`; workers ready — process stopped by timeout (expected) |

### Migrations

One-off scripts exist under `backend/core-api/src/commands/` (`migrate*.ts`). No blanket migration runner required for empty local DB smoke; none executed as mandatory for this baseline.

---

## Pre-existing vs new

**Pre-existing / environment**

- No Docker → no docs Compose Mongo/Redis  
- README `.env.example` vs tree `.env.sample`  
- Mongoose duplicate index warnings; AWS SDK v2 maintenance note; jest worker teardown warning in shared tests  

**New (Raco)**

- `backend/services/raco-brand`, `raco-llm-gateway`, `raco-entitlements`  
- Docs under `docs/` (synced to Project store)

---

## Not claimed

- Full UI smoke / multi-plugin `dev:uis`  
- Commercial SaaS readiness  
- Real LLM credentials  
- Customer-facing rebrand completion  
