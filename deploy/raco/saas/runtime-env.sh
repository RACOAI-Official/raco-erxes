#!/bin/sh
set -eu
if [ -n "${RACO_SAAS_DOMAIN:-}" ]; then
  case "$RACO_SAAS_DOMAIN" in *[!a-z0-9.-]*|'') echo 'Invalid RACO_SAAS_DOMAIN' >&2; exit 1 ;; esac
  printf 'window.env={REACT_APP_API_URL:window.location.origin+"/gateway",RACO_SAAS_DOMAIN:"%s"};\n' "$RACO_SAAS_DOMAIN" > /usr/share/nginx/html/js/env.js
fi
