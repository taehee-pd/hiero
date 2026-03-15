#!/bin/sh
set -eu

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS-$ARCH" in
  Darwin-arm64)
    APP_PATH="$(cd "$(dirname "$0")/.." && pwd)/build/dev-macos-arm64/Icophone-dev.app"
    ;;
  Darwin-x86_64)
    APP_PATH="$(cd "$(dirname "$0")/.." && pwd)/build/dev-macos-x64/Icophone-dev.app"
    ;;
  *)
    echo "Unsupported desktop dev launcher target: $OS-$ARCH"
    exit 1
    ;;
esac

if [ ! -d "$APP_PATH" ]; then
  echo "Desktop app bundle not found at:"
  echo "  $APP_PATH"
  echo "Build the desktop app first if needed."
  exit 1
fi

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

open "$APP_PATH"
