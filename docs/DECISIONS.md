# DECISIONS — Raco AI × erxes (DRAFT log)

**Convention:** `Proposed` / `Accepted` / `Blocked` / `Rejected`.  
**No decision here closes the commercial licence gate.**

---

## D001 — Upstream repository

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Decision | Canonical upstream `https://github.com/erxes/erxes` |

---

## D002 — Version pin

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Decision | Pin to tag **`3.3.2`** (`b5737b8f9a6f3d229cf63081569bfebc7196a29c`) |

---

## D003 — Writable repository

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Decision | Fork `https://github.com/razin0900/https-github.com-razin0900-erxes`; PRs against fork only |

---

## D004 — Commercial / OEM licence path

| Field | Value |
|-------|-------|
| Status | **Blocked** — legal |
| Decision | TBD if commercial distribution / white-label rights needed beyond AGPL self-host |
| Gate | `COMMERCIAL_LAUNCH_GATE.md` remains **NOT APPROVED** |
| Note | Product is **standalone**, not competing multi-tenant SaaS — still do not self-approve the gate |

---

## D005 — Tenant / product mode

| Field | Value |
|-------|-------|
| Status | **Accepted** (binding) |
| Decision | **Standalone / self-hosted** single deployment (`VERSION=os`). **Skip SaaS** entirely (no multi-tenant provisioning, billing, or SaaS management layer). |

---

## D006 — MVP plugin set

| Field | Value |
|-------|-------|
| Status | **Proposed** |
| Decision | Enable **frontline, sales, operation** (+ core); hold EE-badged modules pending counsel |

---

## D007 — Brand system

| Field | Value |
|-------|-------|
| Status | **Blocked** — assets / rights |
| Decision | `raco-brand` + OrgWhiteLabel; customer-facing rebrand off by default |
| Exact ask | Logo, favicon, support/legal emails, trademark permission if replacing erxes marks |

---

## D008 — Node / toolchain

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Decision | Node **22**, pnpm **9.12.3** |

---

## D009 — Plugin asset hosting

| Field | Value |
|-------|-------|
| Status | **Proposed** |
| Decision | Self-host Module Federation remotes |

---

## D010 — Sidecar services

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Decision | Isolated `backend/services/raco-*` |
| Landed | `raco-brand`, `raco-webhooks`, `raco-llm-gateway` (mock) |
| Rejected for product | SaaS entitlements/billing sidecars |

---

## D011 — API credentials

| Field | Value |
|-------|-------|
| Status | **Blocked** — as needed |
| Items | Webhook signing secret + partner URLs; later LLM/voice/SSO/mail |
| Rule | Mock/sandbox until provided; never commit secrets |

---

## D012 — SaaS billing / entitlements

| Field | Value |
|-------|-------|
| Status | **Rejected** (product scope) |
| Decision | Do **not** implement plans/subscriptions/billing/usage-as-SaaS |

---

## D013 — Webhooks for product connectivity

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Decision | Prefer upstream Automations outgoing/incoming webhooks; add isolated `raco-webhooks` for signed multi-endpoint outbound event subscriptions |
| Docs | `WEBHOOKS.md` |

---

## Decision index

**Must decide soon:** D004 (legal), D007 (brand assets), webhook partner endpoints + `RACO_WEBHOOK_SIGNING_SECRET`.  
**Resolved:** D001–D003, D005, D008, D010, D012, D013.
