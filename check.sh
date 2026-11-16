#!/usr/bin/env bash
# Single quality gate used by CI and by build-lab before every push:
# format check, lint, typecheck, tests, build.
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
npm run --silent format:check
npm run --silent lint
npm run --silent typecheck
npm run --silent test
npm run --silent build
