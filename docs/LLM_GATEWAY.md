# LLM_GATEWAY — Raco isolated gateway (DRAFT + MOCK)

**Status:** Interface + **MOCK** adapter only  
**Code:** `backend/services/raco-llm-gateway`  
**Not production.** No real Raco LLM credentials in repo.

---

## 1. Goals

- Keep LLM routing **outside** `core-api` (upgrade-safe sidecar).  
- Primary provider: Raco LLM (when credentials exist).  
- Optional free-tier fallback (configurable; not implemented beyond interface).  
- Default safely to **mock** when keys are missing.

---

## 2. Package layout

| Path | Role |
|------|------|
| `src/adapters/types.ts` | Adapter interface + request/response types |
| `src/adapters/mock-raco-llm.ts` | **MOCK** adapter — clearly labeled in responses |
| `src/gateway.ts` | Gateway with primary + optional fallback |
| `src/main.ts` | Optional HTTP server (`/health`, `/v1/completions`) |

Default HTTP port: **3390** (`RACO_LLM_GATEWAY_PORT`).

---

## 3. Behaviour

| Condition | Result |
|-----------|--------|
| `RACO_LLM_PROVIDER` unset / `mock-raco-llm` | Mock adapter |
| `RACO_LLM_PROVIDER=raco-llm` without `RACO_LLM_API_KEY` | Stay on mock |
| Real network adapters | **Not implemented** — pending credentials (D011) |

Mock completion bodies include `[MOCK Raco LLM — not a production model]`.

---

## 4. Env (never commit secrets)

```bash
# RACO_LLM_GATEWAY_PORT=3390
# RACO_LLM_PROVIDER=mock-raco-llm
# RACO_LLM_API_KEY=   # provide out-of-band; never commit
# RACO_LLM_BASE_URL=  # future real adapter
```

---

## 5. Relation to erxes automations AI

Upstream `backend/services/automations` already has AI provider resolvers (OpenAI, Grok, Kimi, Cloudflare gateway). Raco gateway is an **isolated** sidecar for Raco-owned routing/metering; do not inline Raco vendor keys into automations core. Future integration should be an explicit adapter/plugin call — not a core fork.

---

## 6. Validation

```bash
pnpm nx build raco-llm-gateway
pnpm nx test raco-llm-gateway
```
