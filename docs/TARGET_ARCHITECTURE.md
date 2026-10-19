# TARGET_ARCHITECTURE — Raco AI on erxes (standalone DRAFT)

**Status:** Draft — **standalone / self-hosted** product shape (binding scope from Razin).  
**Upstream pin:** erxes `3.3.2` (`b5737b8f9a6f3d229cf63081569bfebc7196a29c`)  
**Writable fork:** `https://github.com/razin0900/https-github.com-razin0900-erxes`  
**Licence:** `COMMERCIAL_LAUNCH_GATE.md` remains **NOT APPROVED** for commercial claims.  
**Out of scope:** multi-tenant SaaS provisioning, plans/billing, SaaS management layer.

---

## 1. Design goals

1. Keep **erxes as the underlying CX/CRM/engagement platform**.  
2. Ship a **single-deployment** Raco-branded product operators can self-host.  
3. Prefer **config, org white-label, plugins, isolated sidecars**.  
4. Preserve **upstream upgrade path** (track tags; minimize core diffs).  
5. Enable **webhooks** so Raco can connect to other products (prefer upstream automation webhooks; Raco outbound bus for signed subscriptions).

---

## 2. Runtime topology (standalone)

```
   Operator / edge (TLS)
            │
            ▼
   Core UI (brand placeholders)
            │
            ▼
     erxes Gateway :4000
            │
   ┌────────┼────────┐
   ▼        ▼        ▼
core-api  CE plugins  workers
          (frontline, (automations,
           sales,      logs)
           operation)
   └────────┼────────┘
            ▼
     MongoDB + Redis

   Optional Raco sidecars (same deploy):
     raco-webhooks :3391   — outbound signed events
     raco-brand            — config library
     raco-llm-gateway :3390 — MOCK only (optional)
```

Use upstream **`VERSION=os`** (single-tenant). Do **not** build a Raco SaaS control plane.

---

## 3. Raco isolated modules

| Module | Path | Role |
|--------|------|------|
| Brand | `backend/services/raco-brand` | Central placeholders; OrgWhiteLabel mapping off by default |
| Webhooks | `backend/services/raco-webhooks` | Outbound event subscriptions, HMAC, retries |
| LLM gateway | `backend/services/raco-llm-gateway` | MOCK adapter only — lower priority |

---

## 4. Webhooks strategy

1. **First:** Automations outgoing/incoming webhooks (workflow-level).  
2. **Then:** `raco-webhooks` for durable multi-endpoint signed feeds.  
3. **Later:** thin emitters from plugins/core via public APIs — no CRM rebuild.  

See `WEBHOOKS.md`.

---

## 5. Branding

Central `raco-brand` + OrgWhiteLabel when rights/assets allow. Blocked deep chrome removals documented in `BRANDING_GUIDE.md`. Website: https://racoai.io

---

## 6. Upstream maintenance

- `upstream` → `https://github.com/erxes/erxes.git`  
- Track `3.3.x` tags into Raco branches  
- Keep Raco code under `backend/services/raco-*`  

---

## 7. Open decisions

See `DECISIONS.md` (D004 legal, D007 brand assets, webhook emitter wiring).
