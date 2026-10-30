# Deployed CRM functional audit

Updated: 31 October 2026 (Asia/Dhaka).

Deployment: https://erxes.racoai.io

Status: complete for the documented functional test scope, with the exclusions
and coverage limits below. This report does not certify every possible feature,
input, integration, or security scenario.

## Invitation email confirmation

The invitation email fix is deployed and merged through
[PR #22](https://github.com/RACOAI-Official/raco-erxes/pull/22).
Initial invitations now await delivery, and Resend Invite sends an email with
the renewed registration token. Delivery failures are surfaced rather than
reported as success.

The administrator used the live CRM's Resend Invite action for
**sazin@racoai.io**, with **hello@racoai.io** as the sender. The SMTP delivery
record was marked sent and Hostinger acceptance was verified. The CRM owner
subsequently confirmed that Sazin received the invitation email.

Result: **PASS — the invitation flow is verified through recipient receipt.**
Receipt is owner-confirmed; the audit did not access Sazin's private mailbox or
consume the invitation link to register as Sazin.

## GitHub and deployed Gateway verification

Main revision at closure: `95916528c86dde07e2375c5d9857f3b92d003bed`.

[Main Raco CI run 41109206889](https://github.com/RACOAI-Official/raco-erxes/actions/runs/41109206889)
completed successfully: both `verify` and `images` passed. The deployed
WhatsApp email-approval feature was merged through
[PR #21](https://github.com/RACOAI-Official/raco-erxes/pull/21).

The Gateway uses a local image without a revision tag, so its files were compared
directly with the GitHub-built backend image at
`74aa50e8fb6a64a7f914e0131fe58f8ed857dac6`. Gateway source at that reference
revision was also compared with main and had no differences.

- All 30 compiled Gateway application files matched the reference exactly.
- The four additional files were runtime plugin subscription downloads, rather
  than application source differences.
- Each downloaded subscription file matched its live plugin: Core, Frontline,
  Operation, and Sales.

No Gateway redeployment was needed. This confirms application-file consistency;
it does not claim that private server settings or database contents are in Git.

## Documented functional coverage

Recorded live checks passed for the following flows:

- Contacts, companies, leads and lead conversion; saved changes and reload
  persistence.
- Sales pipelines, stages and deals, including stage movement and linked records.
- Operations projects, tasks, status changes and report persistence.
- Tickets and reports, including CSV and spreadsheet downloads.
- CSV company import/export, invalid-row rejection and error reporting.
- Knowledge Base topics, categories and articles; editor readability in light
  and dark themes.
- Public form validation, submission and appearance in the CRM.
- Native Messenger visitor/staff round trips, survey voting, reload persistence
  and staff vote totals.
- Public Help Center search/articles, ticket submission, owner tracking/replies
  and cross-user privacy denial checks.
- Restricted Support/Sales permissions, assignments, notification recipient
  isolation, read state and archive persistence.
- Markdown agent memory upload, read-back and indexing after reopening the agent.
- Incoming WhatsApp messages and automatic AI replies, including recipient
  confirmation of an automatic reply.
- Hostinger SMTP/IMAP authentication, internal test inbox arrival and external
  email import into the CRM.
- WhatsApp approval of an email using a real bare APPROVE reply, followed by
  exactly one sent email and independently verified recipient inbox arrival.
- Member invitation resend through the live owner UI, SMTP acceptance and the
  owner-confirmed receipt by Sazin described above.

Final public smoke checks also passed: CRM and OpenWA HTTPS responses, HTTP to
HTTPS redirection, anonymous CRM user isolation, rejection of unsigned WhatsApp
webhooks, and rejection of unauthenticated OpenWA session access.

## Excluded by the owner

- Payments, including SSLCommerz.
- POS.
- SaaS signup, trials, workspace isolation and billing.
- Offsite backup restoration and disaster recovery.

## Coverage limits and retained observations

- Email rejection and reply-delivery paths have automated regression coverage
  but were not separately exercised live end to end. Live reply-draft creation
  and its approval request were verified; the completed live approval-to-inbox
  delivery test used a composed email.
- The dedicated WhatsApp AI webhook does not use the saved agent Markdown
  memory. Agent memory upload/indexing and automation-agent behavior are separate
  from that endpoint.
- Historical uncertain deliveries were not replayed, avoiding duplicate sends.
- Missing CRM HSTS, CSP and Referrer-Policy headers remain recorded hardening
  observations. Passing functional checks is not an exhaustive security
  assessment or certification.
- Results describe the tested deployment and revision at closure. Later code,
  configuration, mailbox or provider changes require fresh verification.

No unresolved functional blockers remain within the documented tested scope.
Private credentials, invitation tokens, raw customer data and server-only
configuration are intentionally omitted from this report.
