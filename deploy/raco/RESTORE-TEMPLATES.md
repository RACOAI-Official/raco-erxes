# Restore saved automation templates after deployment

The catalog is database data. Deploying frontend/backend source does not copy local templates, agents, inbox channels or credentials to a new workspace.

## Current repair

The standalone template editor incorrectly asked for a trigger before its first action. This branch lets standalone templates start with actions, while ordinary automations still require a trigger. It does not change authentication or grant app tokens additional permissions.

The deployed app token tested on 27 October 2026 could read templates but was denied template creation. It was revoked, and its local private copy removed. No templates were created and no workflow was activated during that attempt.

## Owner-authenticated restoration

Run from this checkout with Node 22. Place an authorized deployed workspace owner's login in a private JSON file **outside the repository**:

```json
{"email":"YOUR_WORKSPACE_OWNER_EMAIL","password":"YOUR_PRIVATE_PASSWORD"}
```

On Linux restrict it with chmod 600. Do not paste credentials into chat, commit them, put them in command arguments, or reuse the local credential file for a different deployment without checking the account.

Validate the portable catalog:

```sh
node scripts/raco-restore-workflow-templates.cjs --check
```

Read-only dry run against the deployed CRM:

```sh
node scripts/raco-restore-workflow-templates.cjs --api-url https://erxes.racoai.io/gateway/graphql --credentials-file /private/crm-owner.json
```

Install the nine missing saved templates:

```sh
node scripts/raco-restore-workflow-templates.cjs --api-url https://erxes.racoai.io/gateway/graphql --credentials-file /private/crm-owner.json --apply
```

The utility requires an authenticated owner, rejects redirects and non-HTTPS targets (unless explicitly allowed for loopback testing), preserves existing names/user edits, verifies the installed catalog, and checks that automation IDs/statuses stayed unchanged. It does not create automations, activate them, send messages, create agents/channels, or change permissions. Run one installer at a time; name matching prevents duplicate reruns but does not provide a concurrency lock. Remove the private credentials file after use according to your secret-management process.

## Catalog and remaining setup

Five lifecycle templates (welcome, lead follow-up, onboarding, feedback and re-engagement), WhatsApp compose/reply, and AI email compose/reply are included. All email delivery steps are **draft creation** and require human review/send in the CRM. Unlike the older local installer, the new lifecycle catalog contains no direct sendEmail actions.

No local agent or inbox IDs are copied. Before using a saved template, configure the deployed Mailcow integration binding and Raco LLM agent; select an appropriate trigger, confirm recipients and input bindings, check consent/exit conditions, and test with an approved recipient. Empty agent/inbox bindings are intentional setup requirements. A saved template itself is not an active automation.

Open /automations?view=templates to verify all nine names. Re-check /automations to confirm none became active. Do not run the older localhost-only installer as a substitute; it targets local credentials and has direct-email lifecycle actions.
