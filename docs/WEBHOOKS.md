# WEBHOOKS — Connecting Raco (standalone erxes) to other products

**Product shape:** standalone / self-hosted (single deployment) — **not** multi-tenant SaaS.  
**Pin:** erxes `3.3.2`  
**Raco module:** `backend/services/raco-webhooks`

---

## 1. What already exists upstream (prefer these first)

| Capability | Where | Use when |
|------------|-------|----------|
| **Automation outgoing webhook** | Automations builder → action `outgoingWebhook` (`backend/services/automations/.../outgoing/`) | You want a **workflow-driven** HTTP call (auth, headers, body builder, retries) after a trigger |
| **Automation incoming webhook** | `POST …/automation/…` via automations service webhook routes | An **external system starts** an erxes automation |
| **Channel / integration inbound webhooks** | Frontline: Facebook, Instagram, Telegram, Mail (`/mail/receive`), Call Pro, etc. | Provider → inbox ingestion (not general product-to-product CRM sync) |
| **Inbox webhook metadata** | `frontline_api/.../inbox/webhooks.ts` | UI/content helpers for inbox-related webhook payloads |

**Recommendation for Razin:** for ad-hoc “when X happens, POST to my API”, start with **Automations → Outgoing webhook**. For a durable, signed, multi-endpoint **event bus** across products, use the Raco outbound module below.

---

## 2. Gap filled by Raco: outbound event subscriptions

Upstream does **not** ship a first-class “register N endpoints, subscribe to CRM event types, HMAC-sign every delivery” bus independent of automation graphs.  
`raco-webhooks` is an **isolated sidecar** for that — it does **not** rebuild CRM.

### Behaviour

- Config-driven endpoint registration (env JSON or file)  
- Event catalog (see §3)  
- HMAC-SHA256 signing (`X-Raco-Signature`, `X-Raco-Timestamp`, …)  
- Retries with exponential backoff  
- Optional HTTP admin surface on port **3391**  
- Disabled unless `RACO_WEBHOOKS_ENABLED=true`

### Emit path (today)

`POST /v1/events` on the sidecar (or `publishRacoWebhookEvent()` from Node).  
Wiring domain mutations (customer/deal create) into this publisher is a **follow-up adapter** — keep it out of core forks.

---

## 3. Event catalog

| Event | Intended meaning |
|-------|------------------|
| `raco.ping` | Connectivity test |
| `customer.created` / `customer.updated` | Core customer lifecycle |
| `company.created` / `company.updated` | Company lifecycle |
| `deal.created` / `deal.updated` | Sales deal lifecycle |
| `conversation.created` | Inbox conversation opened |
| `conversation.message.created` | New conversation message |
| `ticket.created` / `ticket.updated` | Frontline ticket lifecycle |

---

## 4. Payload shape

```json
{
  "id": "uuid",
  "type": "customer.created",
  "createdAt": "2026-10-19T20:00:00.000Z",
  "deployment": "standalone",
  "data": {
    "customerId": "…",
    "email": "…"
  }
}
```

`data` is event-specific. Receivers should ignore unknown fields.

---

## 5. Signing secret (env — never commit)

```bash
# Required when delivering
RACO_WEBHOOK_SIGNING_SECRET=<long-random-secret>
```

Signature algorithm (aligned with erxes mail inbound style):

```text
signature = hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`))
Header: X-Raco-Signature: sha256=<signature>
Header: X-Raco-Timestamp: <unix-seconds>
Header: X-Raco-Event: <event-type>
Header: X-Raco-Delivery: <delivery-id>
```

Verify with `verifyRacoWebhookSignature()` from `raco-webhooks`, or reimplement the same formula in the receiving product.

Optional per-endpoint override: set `signingSecretEnv` on an endpoint to the **name** of another env var (not the secret value).

---

## 6. Register endpoints

### Option A — env JSON

```bash
RACO_WEBHOOKS_ENABLED=true
RACO_WEBHOOK_SIGNING_SECRET=…   # from secret manager
RACO_WEBHOOK_ENDPOINTS_JSON='[
  {
    "id": "partner-orders",
    "url": "https://other-product.example/hooks/raco",
    "events": ["customer.created", "deal.updated"],
    "enabled": true
  }
]'
```

Use `"events": ["*"]` (or omit / empty) to receive all catalog events.

### Option B — file

```bash
RACO_WEBHOOK_ENDPOINTS_FILE=/etc/raco/webhook-endpoints.json
```

File may be either a raw array or `{ "endpoints": [ … ] }`.

### Admin HTTP (sidecar)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness + enabled flag |
| GET | `/v1/events` | Catalog |
| GET | `/v1/subscriptions` | Configured endpoints (no secrets) |
| POST | `/v1/events` | Publish `{ "type", "data" }` |
| POST | `/v1/deliveries/test` | Send `raco.ping` |

Default port: **3391** (`RACO_WEBHOOKS_PORT`).

---

## 7. Using upstream automation outgoing webhooks instead

1. Open Automations builder in Core UI.  
2. Add a trigger (e.g. customer created / conversation message).  
3. Add action **Outgoing webhook** — configure URL, auth (none/basic/bearer/JWT), headers, body, retries.  
4. No Raco sidecar required.

Choose automation when the rule is workflow-specific; choose `raco-webhooks` when multiple products need a stable signed event feed.

---

## 8. Validation

```bash
pnpm nx build raco-webhooks
pnpm nx test raco-webhooks
```

---

## 9. Out of scope

- Multi-tenant SaaS webhook routing / per-customer billing quotas  
- Rebuilding CRM or replacing Automations  
- Committing signing secrets  
