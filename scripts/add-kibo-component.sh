#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <component>"
  echo "Example: $0 gantt"
  exit 1
fi

COMPONENT="$1"
CMD="npx shadcn@latest add @kibo-ui/${COMPONENT}"

echo "Running: ${CMD}"
${CMD}
