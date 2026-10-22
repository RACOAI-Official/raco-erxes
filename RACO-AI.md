# Raco AI CRM — local operation

This is the existing erxes checkout adapted for local, self-hosted Raco AI use.
Use Node 22 and pnpm 9.12.3. Existing MongoDB data, Docker volumes, Redis data,
and local environment values are retained. No billing or tenant provisioning
was added. `VERSION=os` selects the existing self-hosted application mode.

## Start on Windows

For GitHub Actions, versioned container images, and the manual server deployment
workflow, see [CI/CD setup](deploy/raco/README.md). Live CD stays disabled until
the production server, environment, and SSH credentials are configured.

Start Docker Desktop, then run from the repository root:

```powershell
docker start raco-mongodb raco-redis
pnpm start:raco
```

In another terminal:

```powershell
pnpm source:raco
pnpm exec cross-env NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm dev:uis
```

Open http://localhost:3001. The gateway is http://localhost:4000; Core API is
3300, operation API 3307, automation service 3302, and operation UI 3006.
Apollo Router uses loopback port 50000. First startup can take several minutes
to load the Nx graph, generate GraphQL documents, and compile the frontend.
Wait for `Server is running` and `Server ready` before using the application.

`start:raco` runs the previously built backend services directly and honors the
enabled plugin/service lists in `.env`. Rebuild the backends after source edits.
For backend development with watch mode instead, run
`pnpm exec cross-env NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm dev:apis`.
Do not run both backend commands simultaneously.

The local `.env` enables `operation` and the `automations` service. Keep
`ENABLED_PLUGINS=operation`, `ENABLED_SERVICES=automations`, and
`DOMAIN=http://localhost:3001` for this setup. `dev:core-api` starts only Core
API and Gateway; use `dev:apis` to start enabled plugins and services too.
Stop a terminal with Ctrl+C. This does not remove containers or their data.

The owner email is the address supplied during setup. The generated password
is in `.raco-local-credentials.json`, which is ignored by Git and excluded from
the source download. Keep that file private. An existing owner is never reset
by `scripts/raco-local-owner.cjs`.

## AI configuration

Keep credentials only in the local `.env` or the server's environment:

```dotenv
RACO_LLM_BASE_URL=https://your-raco-endpoint/v1
RACO_LLM_MODEL=qwen3
RACO_LLM_API_KEY=your-private-key
RACO_LLM_FALLBACK_ENABLED=true
GEMINI_API_KEY=your-private-gemini-key
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

Restart the backend after environment changes. The automation service owns
the existing AI agent execution bridge. In the CRM's automation AI agent
settings, choose **Raco LLM** and leave the connection key and base URL blank
to inherit server settings. New connections default to `qwen3`. Existing
explicit provider connections are retained; migrate them deliberately if they
should use Raco. The saved provider identifier remains `openai` for compatibility.

The primary and fallback use OpenAI-compatible `/chat/completions`. On a Raco
request failure, the same messages, tool definitions, and runtime options are
sent once to Gemini if fallback is enabled and its key is configured. Fallback
applies only when the primary base URL matches `RACO_LLM_BASE_URL`; other
providers do not silently switch. Set `RACO_LLM_FALLBACK_ENABLED=false` to keep
all model requests on Raco. Enabling fallback allows the prompt/context to be
sent to Google after a primary failure. Free-tier quotas and availability are
controlled by Google; this application does not activate billing.

The existing automation bridge returns complete responses. This change does
not add a standalone streaming chat UI or change the Raco server's streaming
capabilities. The ngrok address configured locally must remain reachable.

Provider references: [Google compatibility](https://ai.google.dev/gemini-api/docs/openai)
and [Google free-tier pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Verification

```powershell
node scripts/raco-smoke.cjs
pnpm exec dotenv -e .env -- tsx --tsconfig backend/services/automations/tsconfig.json backend/services/automations/src/ai/raco-smoke.ts
pnpm exec cross-env RACO_LLM_BASE_URL=http://127.0.0.1:1/v1 dotenv -e .env -- tsx --tsconfig backend/services/automations/tsconfig.json backend/services/automations/src/ai/raco-smoke.ts
pnpm exec tsx --test backend/gateway/src/apollo-router/__tests__/windows-router.spec.ts backend/services/automations/src/ai/bridge/__tests__/racoFallback.spec.ts
pnpm exec cross-env NX_DAEMON=false NX_ISOLATE_PLUGINS=false NODE_OPTIONS=--max-old-space-size=8192 nx run-many -t build -p core-api gateway operation_api automations-service --parallel=1
pnpm exec cross-env NX_DAEMON=false NX_ISOLATE_PLUGINS=false NODE_OPTIONS=--max-old-space-size=8192 nx build core-ui
pnpm exec cross-env NX_DAEMON=false NX_ISOLATE_PLUGINS=false nx test core-ui --runInBand
pnpm exec cross-env NX_DAEMON=false NX_ISOLATE_PLUGINS=false nx test erxes-api-shared --runInBand
```

The failover command overrides the primary only in its child process. It does
not edit `.env` or stop the real Raco endpoint. Smoke output excludes keys,
passwords, auth cookies, and model response bodies.

On 2026-10-21, authenticated login/current-user/contact/company/team queries,
real Raco generation, real Gemini generation, forced application-bridge
failover, six focused tests, the four backend builds, and the frontend bundle
build passed. All 14 core UI test suites (83 tests) passed. Operation
API and Gateway lint passed with existing warnings.
The shared backend suite also passed: 38 suites and 332 tests, including the
MongoDB lifecycle regressions. With the six focused checks and 83 core UI tests,
421 tests passed. Changed TypeScript/JavaScript files have no lint errors; the
Core API entry retains an existing unused-variable warning.
Core API, core UI, automation service, and shared backend lint still report
pre-existing errors in untouched files. The shared backend's remaining lint
error is the inferred string annotation in `src/utils/utils.ts`. The frontend
dependency build also reports existing
`erxes-ui` TypeScript diagnostics even though Nx exits successfully. A successful
bundle build is therefore not a clean repository-wide type/lint certification.
Local diagnostics are in ignored `.raco-*.log` files.

## Startup diagnosis

At takeover, the Docker Linux engine and both database containers were stopped.
After restoring the existing containers, MongoDB reported a writable replica-set
primary and Mongoose connected using the configured direct connection; Redis
returned `PONG`. An independent ping alone does not prove the application's
connection is healthy. A later service disconnect reproduced the immediate
process exit while MongoDB still reported a primary. The shared MongoDB handler
had called `process.exit(1)` on every disconnect/error, including transient
disconnects and intentional closes. It now lets the driver reconnect and lets
graceful shutdown finish; initial connection promises still reject. Connection
logs no longer include database URLs. The underlying transient transport
interruption was not established.

Additional verified Windows failures were the operation project's Unix-only
environment assignments, Gateway's Unix router installer, drive-path module
imports in subscription/schema loading, watcher spawning through `npx`, and Nx
temporary directories containing `build:packageJson`. Those paths now use
cross-platform commands, a checksum-verified native router, compatible imports,
Node-based watcher spawning, and `build-package-json` with a legacy target alias.

## Source, license, and local deployment

Retain `LICENSE.md` and upstream notices. It identifies the community code as
AGPLv3, has an additional SaaS restriction, and treats Enterprise/third-party
components separately. The root package metadata's `MIT` string is inconsistent
with that file; it is not a basis for treating this fork as MIT-licensed.
No Enterprise entitlement or trademark permission is assumed. Raco AI is the
local product name; the interface identifies erxes as its upstream base.

`pnpm source:raco` packages the original tracked source plus current local
modifications and new source files. It excludes local environment credentials,
diagnostic logs, and the generated owner credential. It writes an archive outside
the frontend watcher, then publishes `/assets/raco-source.tar.gz`. The login page
and signed-in profile menu link to it. Regenerate it after every source change
and before building/distributing the frontend. Preserve and make the corresponding
source available to users of a deployed modified version. See
[GNU's source-offer guidance](https://www.gnu.org/licenses/gpl-howto.en.html).

For local deployment, keep the two existing Docker services and run the backend
and frontend commands above. The production frontend bundle is under
`dist/frontend/core-ui`; a static server must provide SPA fallback and the source
archive. A non-development deployment also needs the existing backend Dockerfile
router/Rover assets, environment and reverse-proxy configuration; the development
runner is not a hardened public deployment. No public hosting is configured here.

## Brand assets

The default identity follows https://racoai.io as reviewed on 2026-10-22:
coral `#ff7864`, charcoal `#29292b` / `#1e1e21`, warm white `#f7f5f0`,
and gray `#ebebed`. Instrument Sans is requested through the existing Google
Fonts stylesheet with local sans-serif fallbacks. Light-theme links use a
darker coral for readable contrast; primary buttons use coral with dark text.
Existing semantic success, warning, and error colors remain distinct.

The supplied original logo is `frontend/core-ui/src/assets/raco-logo.png`.
`Logo.tsx` renders it white on dark surfaces and uses a CSS black treatment
on light surfaces. Compact icons and the favicon use the symbol from the
same logo. Organization-specific logo and login copy settings are preserved.
Upstream erxes attribution, license notices, and source downloads remain.

## Saved automation templates

Open `/automations?view=templates` for five editable Raco AI workflows:
welcome series, lead follow-up, customer onboarding, feedback request, and
customer re-engagement. They use core email and delay actions and do not
activate an automation or send messages when installed.

Before activating an automation, configure a suitable customer/lead trigger,
verify the `primaryEmail` and `firstName` input bindings, select a verified
sender and reply-to address in each email step, and review the wording.
Re-engagement requires an inactivity audience and exit conditions; a delay alone
does not test whether a customer has been active. Review exit conditions for
follow-up sequences so customers who already replied do not receive unwanted
reminders. Email delivery requires the existing mail transport configuration.

`node scripts/raco-automation-templates.cjs --check` validates the catalog.
`node scripts/raco-automation-templates.cjs` logs in with the ignored local
credentials file and installs missing templates through the CRM GraphQL API.
Matching template names are preserved, including user edits; rerunning creates
no duplicates. No database reset, migration, or application rebuild is needed.
