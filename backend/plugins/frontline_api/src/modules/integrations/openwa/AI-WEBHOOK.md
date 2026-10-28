# Dedicated WhatsApp AI-reply webhook

Public URL: `https://erxes.racoai.io/gateway/pl:frontline/openwa/ai-reply`

This is an alternative to the CRM automation engine. It receives signed OpenWA
`message.received` events, keeps the normal CRM inbox/contact record, asks an
OpenAI-compatible text endpoint for one concise reply, and sends/stores the reply
through the existing OpenWA composer. It does not use the saved WA agent or its
memory; the instructions are configured separately below. No emails are sent.

## Private server configuration

Keep the existing `OPENWA_*` connection, pinned tenant, integration, session and
webhook-secret configuration. Add these variables to the Frontline API service
using the deployment's existing private env mechanism (not a tracked file):

```dotenv
OPENWA_AI_ENABLED=false
OPENWA_AI_LLM_BASE_URL=https://YOUR-LLM-SERVER/v1
OPENWA_AI_LLM_API_KEY=YOUR-PRIVATE-KEY
OPENWA_AI_LLM_MODEL=YOUR-EXACT-MODEL-ID
OPENWA_AI_MAX_TOKENS=512
# Optional, at most 2000 characters; a short RACO AI sales prompt is built in.
# OPENWA_AI_INSTRUCTIONS=Approved business facts and response instructions
```

The base URL must include the API prefix (normally `/v1`), without credentials,
query strings or fragments. HTTP is supported for an operator-configured private
network endpoint; use HTTPS for a remote server. Redirects are rejected. Only the
configured LLM receives the trimmed customer text and approved instructions.
Never paste secrets into GitHub, screenshots or customer records.

Token budget is configurable from 64 to 2000. The request uses `max_tokens`, not
the automation bridge's completion-token parameter, with both Qwen3's
`chat_template_kwargs.enable_thinking=false` and `/no_think` prompt control.
The serving API must support this request. Empty, unfinished, and unclosed
thinking-block responses are not sent. No reasoning content is returned to the
customer. If your serving engine does not honor these controls, configure its
chat template accordingly before enabling replies.

## Cutover

1. Rebuild/redeploy **Frontline API** with this branch. Preserve existing private
   settings, ingress routing, databases and OpenWA session data.
2. Leave `OPENWA_AI_ENABLED=false` initially. Verify the route is reachable and
   reports disabled (503). This is an expected readiness check, not a delivery test.
3. Pause the old **WA** automation and any n8n/other AI reply workflow for this
   session. This prevents two systems replying to the same message.
4. Replace the session's existing inbox webhook URL with the dedicated URL above;
   use `message.received`, the same session and HMAC signing secret. Do not add a
   second inbox webhook alongside it. The new endpoint also performs inbox intake.
5. Set `OPENWA_AI_ENABLED=true` and recreate only the Frontline API service so the
   environment takes effect. Set the webhook delivery timeout to at least 45 seconds
   if the OpenWA installation exposes that setting (LLM timeout 10s, existing sender
   timeout 30s). Retries never create a second AI reply for the same event.
6. Send a new test message from an approved test phone. Confirm a `sent` result,
   one incoming and one outgoing inbox message, and receipt on the test phone.
   Only a real test confirms end-to-end readiness. Provider acceptance is not a
   guarantee of delivery or a read receipt.

## Behavior and operator recovery

- Own-account messages, groups, status/newsletter broadcasts are ignored.
- Attachments are kept by normal inbox intake but do not receive AI replies.
- Messages older than five minutes (or more than one minute in the future) do not
  get an automatic reply. Normal inbox ingestion can still retain them.
- A stop/unsubscribe or human/agent/representative request pauses the chat in Redis
  indefinitely. This route sends no automated handover acknowledgement and does
  not notify a staff member; monitor the shared inbox and assign a human there.
  The pause key is `openwaId('ai-paused', subdomain, integrationId, chatId)`.
  Only an authorized operator may clear it after confirming permission to resume.
- `extraData.openwaAiReply` on the inbound message records `processing`, `sending`,
  `sent`, or `needs_review`. State is claimed atomically, so duplicate webhook
  deliveries do not generate or send another reply.
- A crash during processing/sending deliberately leaves the message blocked from
  automatic retries. A failed generation or uncertain send records `needs_review`.
  The authenticated webhook response reports this state with HTTP 200 to avoid a
  retry loop. Check the inbox/phone before a human reply; do not delete state to
  force a resend. No automatic recovery assumes an uncertain send failed.
- Logs contain only the inbound message ID and generic `GENERATION_FAILED` or
  `DELIVERY_UNCERTAIN`, never prompts, tokens, credentials or provider response bodies.
- This initial implementation uses only the latest message, a short system prompt,
  and no conversation history/tools. It does not use uploaded knowledge documents,
  CRM automation History, scheduling, proactive compose or email automation.

To stop: set `OPENWA_AI_ENABLED=false` and recreate Frontline API. Restore the
webhook URL ending `/openwa/receive` for inbox-only operation. Keep the old WA
workflow inactive until its original AI failure has been resolved. Retain the
private configuration outside the repository; preserve existing deploy overrides.
