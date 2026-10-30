# Raco AI CI and deployment

The web image includes the Frontline public widgets at `/widgets/`. Build them
with `REACT_APP_WIDGETS_BASE_PATH=/widgets`; both their router and chunk URLs
must use that prefix. The runtime environment supplies the same-origin gateway
and public widgets URL. Live forms use `/widgets/live/:channelId/:formId`;
these are frontend routes, not gateway API routes. Container smoke checks cover
the live route, launcher bundle, and missing-chunk 404 behavior.

`Raco CI` runs on pushes to `main` and `codex/**`, pull requests, and manual runs.
It uses Node 22.23.3, pnpm 9.12.3, and frozen dependency installation. Existing
backend/frontend suites, router/failover tests, automation-template validation,
application builds, and production-container smoke tests gate publication.
The full project lint step reports existing debt without blocking releases.
Shared UI builds also currently emit existing declaration diagnostics; this
pipeline is not a claim that all repository lint/type errors have been fixed.

The container smoke test creates an isolated `raco-ci` Compose project, checks
production GraphQL, the operation UI remote, the logo, and the source offer,
then removes only that disposable project's volumes. No local CRM database,
Docker container, or volume is used by CI.

After a successful push pipeline, GHCR receives two images tagged with the full
commit SHA: `ghcr.io/OWNER/REPO-backend:SHA` and `ghcr.io/OWNER/REPO-web:SHA`.
The backend image includes the four compiled services and their pnpm workspace
dependencies; they run in separate containers. This favors compatibility over
minimal image size. The web image serves core UI and the operation remote on
the same origin. Apollo Router 1.59.2 is checksum-verified and Rover 0.22.0 is
installed with its existing upstream license acceptance. Original application
and dependency license notices are retained. The branded source archive is
served at `/assets/raco-source.tar.gz`.

Inherited erxes publishing/release/webhook jobs are restricted to the `erxes`
repository owner. CodeQL remains available. Raco publishes only into this
repository owner's GHCR namespace, using its job-scoped GitHub token.

## Server setup before enabling deployment

Use a Linux x86-64 server with Docker Engine and Compose supporting `up --wait`
(Compose 2.30 or later recommended), Bash, tar, curl, and adequate image storage.
This repository currently builds comparatively large workspace images; size the
server after the first CI image run. No live server is configured yet.

1. Create a dedicated deploy user/directory, for example `/opt/raco-ai`. The
   user must own that directory and be allowed to run Docker. Docker access
   grants substantial host privileges; use a dedicated deployment key.
2. Set up a reachable MongoDB 7 replica set and Redis on a private network.
   Provisioning/restoring those services is a separate server setup step;
   the production Compose file does not create or reset a database.
   Container URLs must use reachable private hostnames, never Windows loopback
   addresses or `host.docker.internal:27018` from the local installation.
3. Copy `server.env.example` to `/opt/raco-ai/server.env`, fill in server-only
   database, Redis, JWT, mail/storage, Raco LLM, and optional Gemini settings,
   and set `chmod 600 /opt/raco-ai/server.env`. Use a long random JWT secret.
   Keep secrets outside the checkout and GitHub artifacts. Quote literal `$`
   characters according to Docker Compose dotenv syntax.
4. Authenticate the deploy user to `ghcr.io` if the packages are private,
   using a server-held credential with `read:packages`. CI does not transmit
   its GitHub token to the server.
5. Install a TLS reverse proxy for the chosen CRM domain, forwarding to
   `127.0.0.1:8080`, preserving Host and `X-Forwarded-Proto`, and supporting
   websocket upgrades. Only web's loopback port is published; backends remain
   on the Compose network. Configure the existing platform trust-proxy setting
   for the actual proxy topology before exposing the site.
6. Back up MongoDB and uploads before upgrades. The named uploads volume is
   retained across application releases. No automatic database rollback occurs.

## GitHub configuration

Create a GitHub environment named **production**, restrict deployable branches,
and enable required reviewers where the account plan supports them. Merge the
workflow files into the default branch to expose manual workflow dispatch in
GitHub's Actions UI.

Repository variable:

- `RACO_DEPLOY_ENABLED`: leave unset until ready; set to `true` to enable CD.

Production environment variables:

- `RACO_DEPLOY_HOST`: server hostname or IPv4 address.
- `RACO_DEPLOY_USER`: SSH deploy username.
- `RACO_DEPLOY_PORT`: SSH port, default `22`.
- `RACO_DEPLOY_PATH`: absolute path such as `/opt/raco-ai` (no spaces).

Production environment secrets:

- `RACO_SSH_PRIVATE_KEY`: dedicated deployment private key.
- `RACO_SSH_KNOWN_HOSTS`: the server's verified SSH known_hosts entry. For a
  custom port use `[hostname]:port`. Verify the fingerprint independently;
  the workflow never disables host verification or trusts a fresh keyscan.

## Deploy and roll back

Run **Raco Deploy** manually with the full SHA of a successful **push** run of
Raco CI. It checks the successful pipeline, checks out exactly that commit,
copies its deployment files over SSH, pulls those images, and waits for health.
No credentials are required by pull-request CI. CD is skipped until enabled.

If startup fails, the script attempts to restore the previous application SHA
recorded in `current-sha`. This restores application containers, not database
contents or schema changes. Rollback failure requires operator attention.
For an intentional rollback, dispatch a previous successful CI commit SHA.
The script never uses production `compose down`, removes volumes, resets data,
or runs explicit migrations. First-deploy failure leaves containers for diagnosis.

Locally validate delivery configuration with:

```sh
node scripts/ci/check-delivery.cjs
bash -n deploy/raco/deploy.sh scripts/ci/smoke-containers.sh
```

See [GitHub's container publishing guide](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
and [Compose readiness options](https://docs.docker.com/reference/cli/docker/compose/up/).
