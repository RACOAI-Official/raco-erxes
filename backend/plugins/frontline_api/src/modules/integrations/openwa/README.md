# OpenWA connection

This integration targets the OpenWA v0.25 API at docs.open-wa.org. It is a
single server-managed session per CRM process. It supports incoming direct
messages, Core contact matching/creation, native inbox text replies, and a
separate **WhatsApp message (OpenWA)** automation trigger. Groups and status
broadcasts are excluded. Non-text messages show their caption or an explicit
notice to view the attachment in WhatsApp; media import and outbound files/polls
are not supported.

## Server configuration

Set these in the private CRM `.env` and restart Frontline:

```dotenv
OPENWA_BASE_URL=http://127.0.0.1:2785
OPENWA_API_KEY=<OpenWA operator-or-admin key>
OPENWA_SESSION_ID=<session UUID>
OPENWA_INTEGRATION_ID=<CRM integration ID>
OPENWA_SUBDOMAIN=localhost
OPENWA_WEBHOOK_SECRET=<random 32-byte secret encoded as hex>
FRONTLINE_UI_ENTRY_URL=http://localhost:3004/remoteEntry.js
```

Enable `frontline` alongside existing plugins in `ENABLED_PLUGINS`. Build and
serve both `frontline_api` and `frontline_ui`. On this local setup the API is
3304 and the UI remote is 3004. Create a CRM channel/brand and an external
integration with kind `openwa-messenger` through the authenticated CRM API;
save its returned ID in the configuration above. The configured subdomain must
match the hostname used for authenticated CRM requests.

## Register the provider webhook

Use the OpenWA API with its private key in `X-API-Key`:

```http
POST /api/sessions/<session UUID>/webhooks
Content-Type: application/json

{
  "url": "http://host.docker.internal:3304/openwa/receive",
  "events": ["message.received"],
  "secret": "<same OPENWA_WEBHOOK_SECRET>",
  "retryCount": 5
}
```

The local Docker deployment requires `SSRF_ALLOWED_HOSTS=host.docker.internal`
in OpenWA to permit that specific host; retain all other SSRF protection. An
externally hosted deployment should use an HTTPS callback, normally the gateway
path `/pl:frontline/openwa/receive`, and should not expose the plugin port.
Never put the signing secret in the callback URL. The local setup pins the
tenant in server configuration; the callback's hostname cannot change it.

Pair the session from the OpenWA dashboard. A signed provider test probe returns
204. A real inbound message returns 200 only after inbox persistence,
publication, and durable automation queue submission. Invalid signatures return
401; another session returns 403; malformed events return 400; temporary
processing failures return 503. Own messages/groups/statuses are acknowledged
without creating records.

Choose **WhatsApp message (OpenWA)** when building an automation. It supplies
`customerId`, `conversationId`, `content`, `integrationId`, `source`, and `phone`
when available. It requires no additional trigger configuration. Existing
website-messenger workflows are unaffected. Workflows remain inactive until a
user configures and activates them. The existing **Send Erxes Messenger Message**
action targets the website widget. Use **Send WhatsApp message (OpenWA)** for
WhatsApp delivery. Its text body supports normal automation placeholders. An
empty recipient binding replies to the triggering contact; a compose workflow
can set `customerId` to `{{ input.customerId }}` with an input bound to its chosen
contact trigger. The compose and reply templates remain inactive until reviewed.

The integration's CRM detail page also offers a contact selector and text
composer. Authenticated callers can use
`frontlineOpenwaCompose(customerId, text, requestId)`; it checks
`conversationMessageAdd` and visibility of the configured inbox. The contact's
saved international phone supplies the destination. Keep `requestId` unchanged
on retry: the provider's `Idempotency-Key` prevents duplicate sends within its
retention window, and a stored CRM message prevents later resends. The canonical
message is published to the inbox only after OpenWA returns a message ID.
Acceptance does not itself confirm recipient delivery or read status.

Retries reuse deterministic message IDs, recover interrupted inserts, and retain
trigger jobs to avoid duplicate enrolments. Retained trigger jobs require normal
operator retention management after their source messages are no longer
replayable. Automation execution retains the existing queue's retry behavior;
this integration does not guarantee exactly-once execution of arbitrary actions.

## Validation

```powershell
pnpm nx build frontline_api
pnpm nx build frontline_ui
pnpm exec jest --config backend/plugins/frontline_api/jest.config.ts --runInBand --testPathPattern=integrations/openwa
```

Test signature rejection, a signed OpenWA probe, contact matching, duplicate
delivery, queue recovery, and tenant/chat mapping. Pair a phone and send a real
inbound message before verifying end-to-end delivery and an approved reply.
Never send test messages to real WhatsApp recipients without explicit approval.
