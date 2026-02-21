#!/bin/sh
set -e

PLACEHOLDER="/__NEXT_BASE_PATH_PLACEHOLDER__"
TARGET="${BASE_PATH:-}"

grep -rl "${PLACEHOLDER}" /app/ 2>/dev/null | grep -v "entrypoint.sh" | \
  xargs -r sed -i "s|${PLACEHOLDER}|${TARGET}|g"

exec node server.js
