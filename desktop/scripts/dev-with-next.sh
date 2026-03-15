#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
NEXT_PID=""

cleanup() {
  if [ -n "$NEXT_PID" ]; then
    kill "$NEXT_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if ! curl -fsS "http://localhost:3000" >/dev/null 2>&1; then
  pnpm --dir "$ROOT_DIR" dev &
  NEXT_PID=$!

  ATTEMPTS=120
  COUNT=0
  until curl -fsS "http://localhost:3000" >/dev/null 2>&1; do
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$ATTEMPTS" ]; then
      echo "Timed out waiting for http://localhost:3000"
      exit 1
    fi
    sleep 1
  done
fi

pnpm dev:electrobun
