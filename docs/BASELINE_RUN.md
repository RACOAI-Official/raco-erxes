# BASELINE_RUN — Stage One evidence (fork pin 3.3.2)

**Date:** 2026-10-19 (updated with live `dev:core-api` / `dev:uis` recipe)  
**Pin base:** `b5737b8f9a6f3d229cf63081569bfebc7196a29c` (tag `3.3.2`)  
**Fork:** `https://github.com/razin0900/https-github.com-razin0900-erxes`  
**Branch:** `cursor/raco-stage-one-baseline-73a1`  
**Product shape:** standalone / self-hosted (SaaS out of scope)  
**Commercial gate:** **NOT APPROVED** — not production readiness.

---

## Canonical local run (Razin / official recipe on the fork)

```bash
pnpm install

# Tree has `.env.sample` (not `.env.example`). Only if .env missing:
test -f .env || cp .env.sample .env
# Configure MONGO_URL, REDIS_HOST, REDIS_PORT, REACT_APP_API_URL — never commit secrets.
# Leave ENABLED_PLUGINS unset for core-only. If you set it (e.g. frontline,sales,operation),
# also run `pnpm dev:apis` or the gateway will wait forever on service discovery.

# Terminal 1
pnpm dev:core-api      # Gateway + Core API

# Terminal 2 (separate process)
pnpm dev:uis

# Alternative: all plugin APIs
# pnpm dev:apis

# Optional Raco outbound webhooks (docs/WEBHOOKS.md)
# cd backend/services/raco-webhooks && pnpm exec tsx src/main.ts
```

---

## Live run results (this environment, 2026-10-19)

### Data stores

| Store | How | Result |
|-------|-----|--------|
| Redis | `redis-server` (apt); `redis-cli ping` | `PONG` |
| MongoDB 7.0.14 | Official tarball `/tmp/mongodb` (Docker unavailable) | Port 27017 open |

### Commands

| Command | Result |
|---------|--------|
| `pnpm install` | Success |
| `pnpm dev:core-api` | **Success** — Core API + Gateway up |
| `pnpm dev:uis` | **Success** — Core UI compiled; served |
| `raco-webhooks` (`tsx src/main.ts`) | **Success** — health OK (`enabled=false` until configured) |

### Ports / URLs verified

| Endpoint | HTTP | Evidence |
|----------|------|----------|
| http://localhost:3300/health | **200** `ok` | Core API |
| http://localhost:4000/graphql ` { __typename } ` | **200** `{"data":{"__typename":"Query"}}` | Gateway + Apollo Router |
| http://localhost:4000/ | **404** `Cannot GET /` | Expected (no HTML root) |
| http://localhost:3001/ | **200** HTML `<title>erxes</title>` | Core UI (`NX Server ready at http://localhost:3001`, Rspack compiled) |
| http://localhost:3391/health | **200** JSON `service=raco-webhooks` | Optional sidecar |

### Log milestones (`pnpm dev:core-api`)

- `Connected to the database: mongodb://localhost:27017/erxes`
- `erxes-servicecore joined with http://localhost:3300`
- `Plugin core joined service discovery.`
- `UP: core graphql endpoint http://localhost:3300/graphql`
- `Router started successfully`

### `.env` keys that must be set (local)

| Key | Example / note |
|-----|----------------|
| `MONGO_URL` | `mongodb://localhost:27017/erxes` |
| `REDIS_HOST` | `localhost` |
| `REDIS_PORT` | `6379` |
| `REACT_APP_API_URL` | `http://localhost:4000` |
| `NODE_ENV` | `development` |
| `NODE_OPTIONS` | `--max-old-space-size=1536` (recommended) |
| `ENABLED_PLUGINS` | **Leave unset** for core-only. Do **not** set to empty string. If set to real plugin names, run `pnpm dev:apis`. |

Optional webhooks (never commit secrets):

| Key | Note |
|-----|------|
| `RACO_WEBHOOKS_ENABLED` | `true` to deliver |
| `RACO_WEBHOOK_SIGNING_SECRET` | HMAC secret |
| `RACO_WEBHOOK_ENDPOINTS_JSON` or `_FILE` | Endpoint registration |
| `RACO_WEBHOOKS_PORT` | default `3391` |

---

## Pitfalls captured

1. **`.env.example` vs `.env.sample`** — README historically says `.env.example`; this tree has **`.env.sample`**.  
2. **`ENABLED_PLUGINS=` (empty)** — `split(',')` yields `[""]` and gateway loops on `Waiting for plugin  to join service discovery`. Unset the variable entirely, or set real names + `pnpm dev:apis`.  
3. **No Docker** on this VM — used apt Redis + Mongo tarball instead of Compose.  
4. With plugins unset, `dev:uis` started Core UI with **0 remotes** (expected).

---

## Earlier build/test evidence

| Command | Result |
|---------|--------|
| `pnpm nx build erxes-api-shared` / `core-api` / `gateway` | Success |
| `pnpm nx test erxes-api-shared` | 328 passed (pre-existing mongoose/AWS SDK warnings) |
| `pnpm nx run-many -t test -p raco-brand,raco-llm-gateway,raco-webhooks` | 11 passed |

---

## Not claimed

- Full plugin remotes UI smoke with `ENABLED_PLUGINS` + `dev:apis`  
- Commercial / SaaS readiness  
- Authenticated end-to-end login journey in browser  
