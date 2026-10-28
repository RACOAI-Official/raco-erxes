#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo 'Run this disposable smoke stack only in GitHub Actions.' >&2; exit 2; }
export IMAGE_NAMESPACE=raco IMAGE_TAG=${IMAGE_TAG:?Commit SHA required}
stage=$(mktemp -d)
export RACO_ENV_FILE="$stage/server.env"
cat > "$RACO_ENV_FILE" <<'ENV'
DOMAIN=http://localhost:18080
MONGO_URL=mongodb://test-mongo:27017/erxes?replicaSet=rs0&directConnection=true
REDIS_HOST=test-redis
REDIS_PORT=6379
JWT_TOKEN_SECRET=isolated-ci-only-not-a-production-secret
ENV
cat > "$stage/ci.yaml" <<'YAML'
services:
  test-mongo:
    image: mongo:7
    command: [mongod, --replSet, rs0, --bind_ip_all]
    healthcheck:
      test: [CMD, mongosh, --quiet, --eval, "try { if (!db.hello().isWritablePrimary) { rs.initiate({_id:'rs0',members:[{_id:0,host:'test-mongo:27017'}]}); quit(1); } } catch (e) { quit(1); }"]
      interval: 5s
      timeout: 5s
      retries: 30
  test-redis:
    image: redis:7-alpine
    healthcheck:
      test: [CMD, redis-cli, ping]
      interval: 5s
      timeout: 5s
      retries: 15
  plugin-core-api:
    depends_on:
      test-mongo: {condition: service_healthy}
      test-redis: {condition: service_healthy}
  plugin-operation-api:
    depends_on:
      test-mongo: {condition: service_healthy}
      test-redis: {condition: service_healthy}
  automations-service:
    depends_on:
      test-mongo: {condition: service_healthy}
      test-redis: {condition: service_healthy}
YAML
export RACO_HTTP_PORT=18080
compose=(docker compose -p raco-ci --env-file "$RACO_ENV_FILE" -f deploy/raco/compose.yaml -f "$stage/ci.yaml")
# This cleanup affects only the isolated, disposable CI project, never user data.
trap '"${compose[@]}" down --volumes; rm -rf "$stage"' EXIT
"${compose[@]}" up -d --wait --wait-timeout 300
curl --fail --silent http://127.0.0.1:18080/healthz | grep -q ok
curl --fail --silent http://127.0.0.1:18080/gateway/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query racoCiHealth { __typename }"}' | jq -e '.data.__typename == "Query"'
curl --fail --silent http://127.0.0.1:18080/plugins/operation/remoteEntry.js >/dev/null
curl --fail --silent http://127.0.0.1:18080/assets/raco-logo.png >/dev/null
curl --fail --silent http://127.0.0.1:18080/assets/raco-source.tar.gz >/dev/null
curl --fail --silent http://127.0.0.1:18080/js/env.js | grep -q 'REACT_APP_WIDGETS_URL:window.location.origin+"/widgets"'
curl --fail --silent http://127.0.0.1:18080/widgets/live/ci-channel/ci-form | grep -q '<base href="/widgets/"'
curl --fail --silent http://127.0.0.1:18080/widgets/formBundle.js >/dev/null
[[ "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:18080/widgets/missing-ci-chunk.js)" == 404 ]]
echo 'PASS: production GraphQL, plugin remote, branding, source offer, and public widget routes/assets.'
