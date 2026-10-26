# GAP_VS_MASTER_PROMPT — Raco AI branded erxes (standalone)

**Updated:** 2026-10-19  
**Mission:** Branded deployment of erxes — **not** a rebuilt CRM, **not** a SaaS platform.

---

## Done

| Master-prompt item | Evidence |
|--------------------|----------|
| Inspect / pin erxes | `3.3.2` / `b5737b8`; fork remote |
| Inventory + architecture docs | `docs/PROJECT_INVENTORY.md`, `ARCHITECTURE.md`, `ERXES_FEATURE_MATRIX.md`, … |
| Licence + commercial gate | `LICENCE_REVIEW.md`, `COMMERCIAL_LAUNCH_GATE.md` (**NOT APPROVED**) |
| Local install baseline | `BASELINE_RUN.md` — `dev:core-api` + `dev:uis` verified on agent VM |
| Central brand config | `backend/services/raco-brand` + `BRANDING_GUIDE.md` |
| Preserve platform / no SaaS rebuild | Explicit out-of-scope; entitlements stubs removed |
| Webhooks for other products | Prefer automations; `raco-webhooks` + `WEBHOOKS.md` |
| LLM layer scaffold | `raco-llm-gateway` **MOCK** only |
| PRs on fork | #1 merged; #2 draft (local-run docs) |

---

## In progress / next safe engineering

| Item | Status | Needs |
|------|--------|-------|
| Customer-facing brand via OrgWhiteLabel | Mapping + surface audit done; **apply disabled** | Logo/favicon + G5 |
| Replace auth legal footer links | Documented blocked | Verified Raco terms/privacy URLs |
| Domain→webhook emitters | Not started | Confirm event list with Razin |
| Wire Raco LLM into erxes AI surfaces | Blocked | Real Raco LLM API docs + key |
| Security / privacy / deploy / QA packs | Docs stubs not all written | Continue after brand/LLM inputs |

---

## Blocked on Raco inputs

1. **Legal** — counsel on AGPL / distribution / trademark (G1–G5).  
2. **Brand pack** — official logo, favicon, support/legal emails, terms/privacy URLs.  
3. **Raco LLM** — documentation, base URL, auth, model IDs, API key.  
4. **Webhook partners** — signing secret + endpoint URLs.  

---

## Explicitly will not do

- Rebuild erxes or invent missing CRM modules  
- Multi-tenant SaaS billing / provisioning / management layer  
- Invent logos, legal emails, or LLM endpoints  
- Claim commercial white-label approval without gate closure  
