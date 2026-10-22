#!/usr/bin/env bash
set -euo pipefail
root=${1:?Deployment directory required}
namespace=${2:?Image namespace required}
tag=${3:?Commit SHA required}
[[ "$root" =~ ^/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+$ ]] || exit 2
[[ "$namespace" =~ ^ghcr.io/[a-z0-9_.-]+/[a-z0-9_.-]+$ ]] || exit 2
[[ "$tag" =~ ^[a-f0-9]{40}$ ]] || exit 2
export IMAGE_NAMESPACE="$namespace" IMAGE_TAG="$tag" RACO_ENV_FILE="$root/server.env"
[[ -s "$RACO_ENV_FILE" ]] || { echo 'Configure server.env before deploying.' >&2; exit 2; }
[[ "$(stat -c '%a' "$RACO_ENV_FILE")" == 600 ]] || { echo 'server.env must have mode 600.' >&2; exit 2; }
release="$root/releases/$tag/deploy/raco"
compose() { docker compose -p raco-ai --env-file "$RACO_ENV_FILE" -f "$release/compose.yaml" "$@"; }
previous=''
[[ ! -f "$root/current-sha" ]] || previous=$(cat "$root/current-sha")
compose config --quiet
compose pull
if ! compose up -d --wait --wait-timeout 300 || ! compose exec -T gateway node -e \
  "fetch('http://127.0.0.1:4000/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query racoDeployHealth { __typename }'}),signal:AbortSignal.timeout(10000)}).then(r=>r.json()).then(r=>process.exit(r.data?.__typename==='Query'?0:1)).catch(()=>process.exit(1))"; then
  echo 'Deployment failed. Attempting the previous application release.' >&2
  if [[ "$previous" =~ ^[a-f0-9]{40}$ && -f "$root/releases/$previous/deploy/raco/compose.yaml" ]]; then
    export IMAGE_TAG="$previous"
    release="$root/releases/$previous/deploy/raco"
    compose up -d --wait --wait-timeout 300 || echo 'Rollback needs operator attention.' >&2
  fi
  exit 1
fi
printf '%s\n' "$tag" > "$root/current-sha.next"
mv "$root/current-sha.next" "$root/current-sha"
echo "Application deployment healthy: $tag"
# Never remove volumes, reset databases, or run automatic migrations here.
