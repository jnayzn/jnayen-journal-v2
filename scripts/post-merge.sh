#!/usr/bin/env bash
set -euo pipefail

pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push || true
echo "post-merge complete"
