# LLM_GATEWAY — Raco isolated gateway (DRAFT + MOCK)

**Status:** Interface + **MOCK** adapter only  
**Code:** `backend/services/raco-llm-gateway`  
**Mission alignment:** Raco LLM is the **intended primary** AI provider for selected erxes AI features — but only after the **real** Raco LLM API/SDK/docs are inspected.  
**Not production.** No real Raco LLM credentials in repo.

---

## 1. Goals

- Keep LLM routing **outside** `core-api` (upgrade-safe sidecar).  
- Primary provider: **Raco LLM** (when contract + credentials exist).  
- Optional free-tier fallback (configurable; not implemented beyond interface).  
- Default safely to **mock** when keys or API contract are missing.  
- Support (when the real API offers them): text generation, conversation context, streaming, structured outputs, tool calls, token usage, timeouts/errors.  
- **Never** invent endpoints, model IDs, request schemas, or credentials.  
- Keep API keys server-side only — never in browser, public config, or logs.

---

## 2. Blockers before a real Raco LLM adapter

| Missing input | Effect |
|---------------|--------|
| Official Raco LLM docs / OpenAPI / SDK | Cannot implement request/response mapping |
| Base URL + auth scheme | Cannot network |
| `RACO_LLM_API_KEY` (or equivalent) in secrets manager | Stay on mock |
| Confirmed model identifiers | No hard-coded guesses |
| Which erxes AI surfaces to wire (automations AI agent, etc.) | Integration deferred |

Until these exist, `RACO_LLM_PROVIDER=raco-llm` **falls back to mock**.

---

## 3. Package layout

| Path | Role |
|------|------|
| `src/adapters/types.ts` | Adapter interface + request/response types |
| `src/adapters/mock-raco-llm.ts` | **MOCK** adapter — clearly labeled in responses |
| `src/gateway.ts` | Gateway with primary + optional fallback |
| `src/main.ts` | Optional HTTP server (`/health`, `/v1/completions`) |

Default HTTP port: **3390** (`RACO_LLM_GATEWAY_PORT`).

---

## 4. Behaviour

| Condition | Result |
|-----------|--------|
| `RACO_LLM_PROVIDER` unset / `mock-raco-llm` | Mock adapter |
| `RACO_LLM_PROVIDER=raco-llm` without `RACO_LLM_API_KEY` | Stay on mock |
| Real network adapters | **Not implemented** — pending docs + credentials |

Mock completion bodies include `[MOCK Raco LLM — not a production model]`.

---

## 5. Env (never commit secrets)

```bash
# RACO_LLM_GATEWAY_PORT=3390
# RACO_LLM_PROVIDER=mock-raco-llm
# RACO_LLM_API_KEY=   # provide out-of-band; never commit
# RACO_LLM_BASE_URL=  # only after verified from Raco LLM docs
```

---

## 6. Relation to erxes automations AI

Upstream `backend/services/automations` already has AI provider resolvers (OpenAI, Grok, Kimi, Cloudflare gateway). Raco gateway is an **isolated** sidecar for Raco-owned routing; do not inline Raco vendor keys into automations core. Future integration = explicit adapter after API contract is verified.

---

## 7. Validation

```bash
pnpm nx build raco-llm-gateway
pnpm nx test raco-llm-gateway
```
