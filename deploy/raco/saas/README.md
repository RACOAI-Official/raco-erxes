# Raco XOS SaaS — source preparation only

Target: `xos.racoai.io`; customer URLs: `<workspace>.xos.racoai.io`.
This work does not deploy, change DNS, restart the current self-hosted CRM,
convert its database, or activate payment collection.

## Implemented behavior

- The public root serves the signup/plan portal; `/saas` also serves owner
  subscription status independently of normal tenant authentication.
- Signup selects an operator-configured plan, validates a reserved-name-safe
  workspace slug, and emails a 30-minute, one-use verification link. The opaque
  token is hashed in the registry, carried in a URL fragment, and removed from
  browser history. No password is collected before email verification.
- Verification creates a registry organization, its separate database and owner
  through the native Core model. Public access is denied until owner provisioning
  succeeds. An interrupted attempt can resume with its original unexpired link;
  persistent failures require operator review.
- A 14-day trial starts after provisioning. Database resolution rejects paused,
  unprovisioned and expired managed tenants. Static `DB_NAME` values are refused
  for managed tenants. Legacy organizations and the current `VERSION=os`
  installation keep their existing behavior.
- Owner credentials can read subscription status after expiry. Records are
  retained. SSLCommerz hosted checkout remains disabled until merchant credentials, explicit enablement and BDT prices are configured.
- `RACO_SAAS_PLANS` configures labels, prices, seat metadata and descriptions.
  Prices start unannounced. Monthly and yearly terms require customer-initiated payments; automatic recurring debits and paid usage metering are not implemented.
- Email workflows retain human draft approval. Tenant integrations are provisioned
  separately; existing WhatsApp/Mailcow secrets are not copied to new workspaces.

## Source locations

- `backend/core-api/src/modules/raco-saas/`: public endpoints and provisioning.
- `backend/erxes-api-shared/src/utils/saas/raco-access.ts`: tenant access checks.
- `frontend/core-ui/src/modules/raco-saas/SaasPortal.tsx`: public portal.
- `scripts/raco-saas-smoke.cjs`: disposable two-tenant integration test.

## Future deployment configuration

Keep a separate private environment based on `saas.env.example`, a fresh registry
and tenant databases, and a separate Redis deployment. Do not change the current
`.env` to SaaS mode or point this configuration at its database. Choose final
prices before selling plans. Native invitation/password-reset email needs its
normal Core email provider in addition to the signup verification SMTP setup.

`compose.yaml` overlays `../compose.yaml`. When deployment is explicitly
authorized, use a new Compose project and a private environment; the existing
manual deployment gate remains disabled. The web runtime receives the public
SaaS domain and uses the same-origin gateway. Nginx overwrites client-supplied
tenant headers. Configure wildcard TLS for `xos.racoai.io` and
`*.xos.racoai.io` before publishing. Expose no database, cache or backend ports.
MongoDB/Redis infrastructure is operator-owned, not created by the overlay.

CI builds Frontline alongside Core, Gateway, Operation and Automations and
packages their UIs. No CI job automatically deploys this SaaS configuration.

## Validation

```sh
pnpm --dir backend/erxes-api-shared build
pnpm exec tsc -p backend/core-api/tsconfig.build.json
pnpm exec tsc-alias -p backend/core-api/tsconfig.build.json
pnpm exec jest --config backend/erxes-api-shared/jest.config.ts --runInBand --testMatch='**/raco-access.spec.ts'
pnpm exec jest --config backend/core-api/src/modules/raco-saas/jest.config.cjs --runInBand
RACO_SAAS_TEST_MONGO_URL='mongodb://127.0.0.1:27018/test?directConnection=true' RACO_SAAS_TEST_REDIS_PORT=16389 node scripts/raco-saas-smoke.cjs
```

Use dedicated Redis for the integration test. It refuses port 6379 and drops
only its explicitly named test databases. Verification mail is mocked; no
external messages are sent.

## SSLCommerz setup (later)

The adapter implements hosted checkout, a persistent payment ledger, signed IPN
callbacks and server-to-server transaction validation. The authenticated owner
selects a configured monthly or yearly BDT price. Amounts come from server
configuration. Successful live payments extend access by one calendar month or
year, preserving remaining trial or paid time. Duplicate notifications cannot
extend a term twice. High-risk payments require operator review. Sandbox payments
are recorded but never grant paid access.

Create a merchant account separately. Set `RACO_SSL_STORE_ID` and
`RACO_SSL_STORE_PASSWORD` in the private environment, configure positive
`monthlyPrice` and/or `yearlyPrice` values in `RACO_SAAS_PLANS`, and set
`RACO_SSL_ENABLED=true`. Use `RACO_SSL_MODE=sandbox` for merchant integration
testing. Live collection additionally requires `RACO_SSL_MODE=live` and
`RACO_SSL_ALLOW_LIVE=true`. Never put merchant secrets in source or browser config.
No account, credentials or actual plan prices have been configured by this work.

When deployment is authorized, the provider must reach:

- `https://xos.racoai.io/gateway/saas/sslcommerz/ipn`
- `https://xos.racoai.io/gateway/saas/sslcommerz/return/success`
- `https://xos.racoai.io/gateway/saas/sslcommerz/return/fail`
- `https://xos.racoai.io/gateway/saas/sslcommerz/return/cancel`

Browser redirects do not activate access. Card and mobile-wallet details are
entered on SSLCommerz. Refunds and chargebacks require manual merchant/operator
handling; automatic refund or access reversal is not implemented. Merchant
sandbox and live end-to-end verification remain pending account setup.
See https://developer.sslcommerz.com/doc/v4/ for the provider protocol.

The smoke test mocks all provider requests and checks pricing, owner scope,
signatures, canonical validation, concurrent/replayed callbacks, calendar term
renewal, risk review and sandbox isolation. No payment or external email is sent.
