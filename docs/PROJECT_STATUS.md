# PROJECT_STATUS — Raco AI × erxes

**Updated:** 2026-10-19  
**Product shape:** **Standalone / self-hosted** (SaaS explicitly out of scope)  
**Phase:** Stage One baseline + webhooks scaffold on writable fork  
**Commercial launch gate:** **NOT APPROVED**  
**Fork:** `https://github.com/razin0900/https-github.com-razin0900-erxes`

---

## Snapshot

| Area | State |
|------|-------|
| Pin | tag **`3.3.2`** / `b5737b8f9a6f3d229cf63081569bfebc7196a29c` |
| Upstream remote | `https://github.com/erxes/erxes` |
| Runtime baseline | Partial — see `BASELINE_RUN.md` |
| SaaS / billing | **OUT OF SCOPE** — not implemented |
| Brand | Scaffold (`raco-brand`); customer-facing rebrand off |
| Webhooks | Upstream automations documented + `raco-webhooks` outbound sidecar |
| LLM | Optional MOCK only (`raco-llm-gateway`) |

---

## Pin confirmation

```text
git rev-parse HEAD → b5737b8f9a6f3d229cf63081569bfebc7196a29c
git describe --tags --exact-match → 3.3.2
```

---

## Webhooks — exists vs added

| Capability | Status |
|------------|--------|
| Automations **outgoing** webhook action (auth, retries, body) | **Exists upstream** — prefer for workflow rules |
| Automations **incoming** webhook triggers | **Exists upstream** |
| Channel inbound webhooks (FB/IG/Telegram/Mail/CallPro) | **Exists upstream** — provider ingestion |
| Signed multi-endpoint **outbound event bus** | **Added** — `backend/services/raco-webhooks` |
| Docs | `docs/WEBHOOKS.md` |

Domain emitters (auto fan-out from customer/deal mutations) = **follow-up**, not CRM rebuild.

---

## Baseline evidence (summary)

| Step | Result |
|------|--------|
| Node / pnpm | 22.23.3 / 9.12.3 |
| Redis / Mongo | OK (apt Redis + Mongo 7 tarball; no Docker) |
| `pnpm install` | Success |
| build `erxes-api-shared`, `core-api`, `gateway` | Success |
| test `erxes-api-shared` | 328 passed (pre-existing warnings) |
| build/test `raco-brand`, `raco-llm-gateway`, `raco-webhooks` | Success (11 tests) |
| **`pnpm dev:core-api`** | **Up** — `:3300/health` 200; Gateway GraphQL `:4000` 200; Router started |
| **`pnpm dev:uis`** | **Up** — http://localhost:3001 200 (Rspack compiled) |
| `raco-webhooks` | **Up** — `:3391/health` 200 (`enabled=false` until configured) |
| Full plugin remotes (`ENABLED_PLUGINS` + `dev:apis`) | Not run (core-only; leave `ENABLED_PLUGINS` unset) |

Detail: [BASELINE_RUN.md](./BASELINE_RUN.md) · README Quick Start includes fork recipe

---

## Implemented vs blocked

**Implemented:** pin, docs sync, brand placeholders, webhook docs + outbound sidecar, optional LLM mock, standalone architecture/docs retarget.  

**Blocked / out of scope:** SaaS billing & multi-tenant management; commercial gate approval; invented brand emails/logos; real LLM keys; automatic CRM→webhook wiring.

---

## Remaining decisions for Raco legal / creds

1. Legal contact + counsel view of AGPL / competition clause for **standalone** distribution (G1–G3).  
2. Brand pack: logo, favicon, support/legal emails (D007 / G5).  
3. `RACO_WEBHOOK_SIGNING_SECRET` + partner endpoint URLs.  
4. Whether domain event emitters are needed next (after webhook registration works).  
