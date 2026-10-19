# COMMERCIAL_LAUNCH_GATE

## Gate status: **NOT APPROVED**

**Date opened:** 2026-10-19  
**Owner:** Raco AI commercial + legal (engineering cannot close)  
**Rule:** Never mark this gate approved on assumptions, marketing pages alone, or engineering progress.

---

## 0. Product-shape note (2026-10-19)

**Target product:** standalone / self-hosted Raco AI–branded erxes (**not** a multi-customer SaaS platform).  
**Engineering must not** implement SaaS provisioning, plans/subscriptions/billing, or a SaaS management layer.

This **does not** self-approve the gate. AGPL attribution and `LICENSE.md` (including the competing-SaaS hosting restriction) still apply. White-label / trademark questions (G5) remain open for customer-facing mark replacement. Counsel must still decide what rights are required for Raco’s chosen distribution model.

---

## 1. Purpose

Block **commercial** white-label / public distribution claims for erxes-derived **Raco AI** until licence, trademark, and edition rights are evidenced in writing.

---

## 2. Blocking criteria

| ID | Criterion | Status | Evidence / gap |
|----|-----------|--------|----------------|
| G1 | Written agreement (if needed) covering Raco white-label + intended **standalone/self-host** distribution | **OPEN** | Confirm with counsel whether OEM/Platform terms are required |
| G2 | Clarity on “not permitted to be hosted as a SaaS version to compete with erxes Inc.” vs Raco’s **non-SaaS** standalone model | **OPEN** | `LICENSE.md` header — counsel interpretation required; engineering will not self-clear |
| G3 | Clarity on AGPL source-offer vs commercial relicense for shipped code | **OPEN** | AGPLv3 in `LICENSE.md` |
| G4 | List of plugins Raco may commercially use (CE vs EE) | **OPEN** | README EE badges vs public tree vs docs CE list — conflicts |
| G5 | Trademark / branding permission (Raco AI replace erxes marks) | **OPEN** | Not found as a public grant |
| G6 | Hosted asset policy (`plugins.erxes.io` vs self-host) | **OPEN** | Docs introduction production note |
| G7 | Legal contact designated at Raco + erxes counterparty identified | **OPEN** | Decision required |

**None of G1–G7 are satisfied. Status remains NOT APPROVED.**

---

## 3. Non-blocking (may proceed carefully)

| Item | Allowed now? | Notes |
|------|--------------|-------|
| Private engineering sandbox / self-host baseline | Conditionally | Subject to AGPL if distributing; no commercial GA claim |
| Brand config scaffolding + placeholders | Yes | No invented logos/emails; rebrand off by default |
| Webhooks for product-to-product integration | Yes | Prefer upstream automations; Raco outbound sidecar |
| Architecture / docs | Yes | No production claim |
| SaaS billing / tenant provisioning | **No — out of product scope** | |
| Committing secrets / claiming production ready | **No** | |

---

## 4. Commercial signals (not approval)

Marketing pages (Platform / Infrastructure / Enterprise editions) are **not** a licence grant.

---

## 5. Required Raco inputs

1. **Legal contact** empowered to interpret AGPL + SaaS-competition clause for standalone distribution.  
2. Brand asset pack + display name (if replacing marks).  
3. Confirm CE-first plugin list.  

---

## 6. Exit condition (future)

Gate may move to **APPROVED** only with written counsel sign-off referenced here. Until then:

# NOT APPROVED
