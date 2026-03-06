#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${1:-https://registry.npmjs.org}"
PACKAGE="${2:-react}"

echo "[info] npm registry: ${REGISTRY}"
echo "[info] npm proxy env: HTTP_PROXY=${HTTP_PROXY:-<unset>} HTTPS_PROXY=${HTTPS_PROXY:-<unset>}"

echo
set +e
curl -I "${REGISTRY}" --max-time 15 | head -n 6
CURL_CODE=$?
set -e

echo
if [ "$CURL_CODE" -ne 0 ]; then
  echo "[warn] curl to registry failed. This is usually proxy/network policy."
fi

echo "[info] trying npm ping against ${REGISTRY}..."
set +e
npm --registry "${REGISTRY}" ping
PING_CODE=$?
set -e

if [ "$PING_CODE" -ne 0 ]; then
  cat <<MSG
[error] npm cannot reach registry (${REGISTRY}).
Likely causes:
  - proxy returns 403 for CONNECT
  - direct egress blocked
Fix:
  1) use an internal mirror and set npm registry to it
  2) update proxy allowlist for npm registry host
MSG
  exit 1
fi

echo "[info] trying npm view ${PACKAGE} version..."
npm --registry "${REGISTRY}" view "${PACKAGE}" version
