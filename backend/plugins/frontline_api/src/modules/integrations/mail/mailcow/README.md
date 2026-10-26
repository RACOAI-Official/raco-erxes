# Mailcow inbound email bridge

`bridge.py` connects a Mailcow mailbox to the existing CRM signed email webhook.
It uses Python 3.10+ standard libraries, IMAPS with certificate verification,
and read-only `BODY.PEEK` access. Mail stays in Mailcow and its read flags stay
unchanged. No MX changes or Mailcow admin API key are required.

## Setup

1. Configure the operator-managed SMTP mailbox described below, then create
   a native `mail` inbox using `integrationsCreateExternalIntegration` with
   `data: {provider: "mailcow", senderName: "Sales"}`. Its receiving address is
   the configured `MAILCOW_ADDRESS`, without Cloudflare provisioning or MX changes.
2. Set `MAIL_WEBHOOK_SECRET` privately on the CRM deployment. Derive a tenant
   signing key using the existing `deriveTenantSecret(master, tenant)` contract:
   HMAC-SHA256, master secret as key, resolved CRM mail tenant as UTF-8 message,
   hex digest. The tenant is `MAIL_TENANT` when configured, otherwise the
   normalized CRM subdomain (`localhost` locally). Give the bridge only this
   derived key, never the master secret.
3. Set the following environment variables privately on the bridge host:

```dotenv
MAILCOW_IMAP_HOST=mail.example.com
MAILCOW_IMAP_PORT=993
MAILCOW_IMAP_USER=support@example.com
MAILCOW_IMAP_PASSWORD=<mailbox password or supported app password>
MAILCOW_FOLDER=INBOX
MAILCOW_POLL_SECONDS=30
MAILCOW_STATE_FILE=/persistent/private/mailcow-checkpoint.json
CRM_MAIL_WEBHOOK_URL=https://crm.example.com/pl:frontline/mail/receive
CRM_MAIL_ADDRESS=<CRM inbox receiving address>
CRM_MAIL_SIGNING_KEY=<derived tenant key>
```

The local endpoint is `http://localhost:3304/mail/receive`. For remote Mailcow,
run the bridge where it can reach both IMAPS and the CRM's public HTTPS endpoint.
The CRM hostname must resolve to the intended tenant. Never use a localhost
callback from another server.

Run `python bridge.py` as a supervised service with a persistent checkpoint and
one process per mailbox. First startup establishes the current highest UID;
only subsequent messages are imported. Checkpoint updates follow successful
CRM acknowledgment. Errors retry without advancing it; CRM message IDs provide
deduplication. A UIDVALIDITY or mailbox identity change requires operator review
and deliberately stops importing until the checkpoint is reconciled.

Messages retain sender, subject, threading headers, HTML/plain text, and MIME
attachments. Existing CRM attachment and inbound rate limits apply. A rejected
message blocks later messages until resolved, preserving visibility of failures.
Existing email triggers can process imported messages. No AI replies are
activated automatically.

## AI email workflows with human approval

Use `Email Received -> AI Agent -> Draft Email Reply` for inbound mail. Scope
the trigger's `integrationIds` to the intended inbox. The draft content can bind
to `{{ actions.<ai-step-id>.text }}`. Do not append a Send Email step. A teammate
reviews the draft in the conversation and confirms Send, or edits/discards it.

For new compositions, the same draft action accepts `mode: "compose"` plus
`integrationId`, optional `customerId`, `to`, `subject` and `content` bindings.
Install the compose template on a deliberately chosen contact trigger; keep it
inactive until the recipient and generation brief have been reviewed. The
authenticated `frontlineMailComposeDraft` mutation also creates these pending
drafts directly with a stable `requestId`; it never invokes SMTP. Draft approval
continues through the permission-checked `mailDraftApprove` mutation. UI draft
sends, manual composition/replies and retries show a confirmation prompt.

## Direct Mailcow SMTP replies

Set these on the CRM backend, alongside the private mailbox credentials:

```dotenv
MAILCOW_SUBDOMAIN=<exact CRM request subdomain>
MAILCOW_ADDRESS=support@example.com
MAILCOW_SMTP_HOST=mail.example.com
MAILCOW_SMTP_PORT=587
MAILCOW_SMTP_USER=support@example.com
MAILCOW_SMTP_PASSWORD=<private mailbox password>
```

SMTP requires STARTTLS on 587 or implicit TLS on 465 with valid certificates.
Only the pinned tenant and exact sender address use this transport. Other mail
stays on the existing Cloudflare/platform lane. SMTP acceptance means queued,
not recipient delivery. Replies preserve Message-ID threading and use the base
mailbox Reply-To without requiring plus addressing. Attachments are read from
CRM storage; email reactions are explicitly unsupported. Passwords are never
stored in integration details or returned by GraphQL.

The optional `run-bridge.cjs` launcher reads its environment and derives the
tenant signing key before starting Python. It requires `CRM_MAIL_WEBHOOK_URL`,
`MAILCOW_STATE_FILE`, the IMAP settings above, and optional `MAILCOW_PYTHON`.
Load the private environment with the deployment's usual secret management.
The existing Cloudflare-specific setup wizard/worker diagnostic is not a
Mailcow provisioner; create this operator-managed inbox through the native API.

Validate with `python -m unittest discover -s . -p test_bridge.py`, then send an
approved new email after starting the bridge and confirm the CRM conversation.
Never commit mailbox passwords, signing keys, checkpoints or mailbox contents.
