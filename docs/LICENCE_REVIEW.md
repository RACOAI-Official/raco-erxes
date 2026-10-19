# LICENCE_REVIEW — erxes for Raco AI white-label / SaaS

**Status:** Legal review **not complete**. No approval implied.  
**Inspected texts:** repo `LICENSE.md` at tag `3.3.2`; official docs introduction; erxes.io pricing/edition pages; GitHub issue clarification.  
**This document is technical inventory for counsel — not legal advice.**

Evidence tags: `verified-from-source` | `inferred-from-docs`.

---

## 1. Files and pages reviewed

| Artifact | Location | Present at 3.3.2? |
|----------|----------|-------------------|
| Primary licence text | `LICENSE.md` (repo root) | Yes — verified-from-source |
| NOTICE | — | **No NOTICE file** — verified-from-source |
| EE licence file | `ee/LICENSE` (referenced) | **Missing** — no `ee/` directory — verified-from-source |
| Docs licensing section | [erxes.io/docs/introduction](https://erxes.io/docs/introduction) | Yes — verified-from-source |
| Platform Edition | [erxes.io/pricing/platform-edition](https://erxes.io/pricing/platform-edition) | Marketing — verified-from-source |
| Infrastructure Edition | [erxes.io/pricing/infrastructure-edition](https://erxes.io/pricing/infrastructure-edition) | Marketing — verified-from-source |
| Enterprise Edition | [erxes.io/pricing/enterprise-edition](https://erxes.io/pricing/enterprise-edition) | Marketing — verified-from-source |
| Maintainer clarification | [Issue #4609](https://github.com/erxes/erxes/issues/4609) (Sep 2023) | Community clarification — verified-from-source |
| Security contact | `SECURITY.md` → `info@erxes.io` | verified-from-source |

---

## 2. `LICENSE.md` header (verbatim summary)

Copyright (c) 2022-present **erxes Inc.**

Portions licensed as follows (**verified-from-source** — `LICENSE.md` lines 1–9 at tag `3.3.2`):

1. Plugins named `*-ee` under the historical `ee/` directory → licence in `ee/LICENSE`.  
2. Third-party components → their original licences.  
3. Content outside those restrictions → **AGPLv3** (full text follows in the same file).  
4. Explicit additional statement: **“erxes is not permitted to be hosted as a SaaS version to compete with erxes Inc.”**

Full AGPLv3 text is included in `LICENSE.md` (same file; ~35KB).

---

## 3. Implications for Raco AI (open questions — not conclusions)

### 3.1 AGPLv3 network copyleft

AGPL requires offering corresponding source to users of a modified version accessed over a network.  
**Open:** How Raco will comply (public fork, customer source offer, or commercial licence that replaces AGPL obligations).

### 3.2 SaaS competition restriction

The header restriction is **additional to** AGPL and is central to a Raco-branded multi-tenant SaaS.  
**Open:** Whether Raco’s planned product “competes with erxes Inc.” under erxes Inc.’s interpretation; whether Platform / Infrastructure / OEM contracts waive or replace this clause.

### 3.3 Enterprise Edition plugins

- README badges Content, Accounting, Tourism, Property, Team, Finance as **EE Only**.  
- Public tree at `3.3.2` still contains `content_*`, `accounting_*`, `tourism_*` (and other) plugin folders; **no `ee/` tree / `ee/LICENSE`**.  
- Docs introduction lists Content as Community Edition — **conflicts with README EE badge**.  

**Open:** Which plugins Raco may commercially redistribute/host without an EE/Platform/Infrastructure contract.

### 3.4 package.json SPDX noise

Root `"license": "MIT"` vs AGPL badge / `LICENSE.md` / `AGPL-3.0-only` on shared libs.  
**Open:** Counsel should treat `LICENSE.md` + contract as controlling; do not rely on SPDX fields.

### 3.5 Commercial editions (marketing pages only)

| Edition | Public pricing signal | Relevance to white-label SaaS |
|---------|----------------------|-------------------------------|
| Community | Free / AGPL framing on pricing | Self-host CE features |
| Enterprise | Custom (“Let’s Talk”) | Security/compliance/support |
| Platform | Custom; “build platforms” with erxes backend | Closest marketing fit for OEM-style products |
| Infrastructure | Custom annual, “typically over $100,000 USD”, possible revenue share | Explicit platform/infrastructure partnership |

Evidence: pricing pages — **verified-from-source** (marketing). **No signed terms retrieved.**

### 3.6 Older partner FAQ (caution)

help.erxes.io partner FAQ (dated ~2020) states agencies may sell on-premise and keep revenue — **inferred-from-docs / possibly stale**; do not override `LICENSE.md` SaaS clause.

---

## 4. Licence gate open questions (for Raco legal contact)

1. Confirm written OEM / white-label / SaaS rights with **erxes Inc.** (contact starting point: `info@erxes.io` per SECURITY.md; sales via pricing CTAs).  
2. Obtain current **`ee/LICENSE`** or successor EE terms covering any EE-marked plugins Raco needs.  
3. Clarify whether **Platform Edition** or **Infrastructure Edition** is the correct SKU for a Raco-branded multi-tenant SaaS on erxes.  
4. Clarify AGPL **source-offer** obligations if any CE code remains under AGPL in production.  
5. Clarify use of **`plugins.erxes.io`** hosted assets vs mandatory self-hosting of plugin assets.  
6. Clarify trademark / brand: removing erxes marks and using **Raco AI** branding (white-label).  
7. Resolve SPDX/`package.json` inconsistencies in any Raco fork notices.  
8. Confirm whether enabling upstream `VERSION=saas` is permitted under the commercial agreement.

---

## 5. What engineering may do while the gate is open

- Inspect, document, and plan against the public repo.  
- Prototype branding **locally** in a private sandbox **without** public competing SaaS launch.  
- Prefer plugin/config isolation to minimize fork surface.  

**Must not:** claim commercial launch approval; ship public Raco SaaS; ignore EE badges; commit secrets.

---

## 6. Cross-links

- Approval tracker: `COMMERCIAL_LAUNCH_GATE.md` (**not approved**)  
- Product decisions: `DECISIONS.md`
