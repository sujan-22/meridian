#!/usr/bin/env bash
# Build once, then serve the app against the test database on :3100 so the
# browser suites never touch real tracked time. The dev server on :3000 keeps
# running untouched.
set -euo pipefail

cd "$(dirname "$0")/.."

export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
set -a; source .env.test; set +a

ADMIN_URL="${DATABASE_URL%/*}/postgres"

echo "==> resetting quanta_test"
psql "$ADMIN_URL" -tAc "drop database if exists quanta_test;" >/dev/null
psql "$ADMIN_URL" -tAc "create database quanta_test;" >/dev/null

echo "==> migrating"
pnpm exec drizzle-kit migrate >/dev/null

echo "==> seeding fixtures"
pnpm exec tsx scripts/seed-test.ts

if [ "${1:-}" = "--serve" ]; then
    echo "==> building"
    pnpm exec next build >/dev/null
    echo "==> serving on http://localhost:3100"
    exec pnpm exec next start -p 3100
fi
