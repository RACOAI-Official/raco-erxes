# IMPLEMENTATION_PLAN — Raco AI × erxes (standalone)

**Product shape (binding):** standalone / self-hosted Raco AI–branded erxes — **not** a multi-customer SaaS platform.  
**Skip:** multi-tenant SaaS provisioning, plans/subscriptions/billing, usage-quotas-as-SaaS, SaaS management layer.  
**Licence:** Commercial white-label / distribution still gated by `COMMERCIAL_LAUNCH_GATE.md` (**NOT APPROVED**). Preserve AGPL + attribution.

---

## Stage map

| Stage | Goal | Status | Primary outputs |
|-------|------|--------|-----------------|
| 1 Acquire / inventory | Official baseline | **In progress on fork** | `docs/*`, pin 3.3.2 |
| 2 Licence gate | Rights clarity | **Gate open / NOT APPROVED** | `LICENCE_REVIEW.md`, `COMMERCIAL_LAUNCH_GATE.md` |
| 3 Target architecture | Standalone overlay | **Updated** | `TARGET_ARCHITECTURE.md`, `DECISIONS.md` |
| 4 White-labelling | Central brand config | **Scaffolded** | `raco-brand`, `BRANDING_GUIDE.md` |
| 5 Multi-tenant SaaS | — | **OUT OF SCOPE** | Do not implement |
| 6 Plans / billing / usage | — | **OUT OF SCOPE** | Do not implement |
| 7 LLM Gateway | Optional mock only | Mock scaffold (lower priority) | `raco-llm-gateway` |
| **Webhooks** | Connect to other products | **In progress** | Prefer upstream automations; `raco-webhooks` for signed outbound bus; `WEBHOOKS.md` |
| 8 Voice / Bangla | Verified APIs only | Not started | Block without contracts |
| 9 Onboarding | Operator UX for standalone | Not started | Config + light plugins |
| 10 Security / privacy | Evidence-based | Not started | Reviews + tests |
| 11 Testing / QA | Automated + manual | Partial baseline | CI on fork |
| 12 Deployment / ops | Single-deploy configs | Not started | Compose/docs |
| 13 Monitoring | Readiness | Not started | Sentry/metrics |
| 14 Upstream maintenance | Pin + merge path | Draft | Tracking tags |
| 15 Go-live checklist | Standalone release | Blocked on gate + evidence | Checklist |
| 16 Final deliverables | Root README sync | Later | App repo + store |

---

## Immediate engineering sequence

1. Keep fork pinned to **`3.3.2`**.  
2. Maintain `docs/` + Project store mirror.  
3. Baseline: Node 22, pnpm 9.12.3, Mongo + Redis, `pnpm install`, build/test evidence.  
4. Brand: `raco-brand` placeholders only until G5 / assets.  
5. **Webhooks:** document upstream automation webhooks; run `raco-webhooks` for signed multi-endpoint outbound; wire domain emitters later without core CRM rebuild.  
6. Do **not** implement SaaS billing/tenant provisioning.  
7. Parallel legal track for commercial distribution rights — engineering stays sandbox / self-host.

---

## Workstream principles

- Prefer **plugins, env, org white-label, isolated `backend/services/raco-*` sidecars**.  
- Prefer **existing** automation/integration webhook points before new code.  
- Never commit secrets; use `.env.sample` patterns.  
- Every production claim needs evidence; licence never bypassed.  

---

## Dependencies / blockers

| Blocker | Blocks | Owner |
|---------|--------|-------|
| Legal agreement (if commercial distribution / competing SaaS terms apply) | Public commercial go-live | Raco legal |
| Brand assets + support/legal emails | Customer-facing rebrand | Raco brand |
| Webhook signing secret + partner endpoint URLs | Live outbound delivery | Raco ops |
| Domain→webhook emitter adapters | Automatic CRM event fan-out | Raco eng (follow-up) |
| LLM / voice credentials | Optional AI stages | Raco ops — later |
