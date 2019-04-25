#!/usr/bin/env sh

set -eu

files=$(find server/tests/api/check-params -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true mocha-parallel-tests --max-parallel 4 --timeout 5000 --exit --require ts-node/register --bail $files

mocha --timeout 5000 --exit --require ts-node/register --bail server/tests/api/notifications/index.ts
mocha --timeout 5000 --exit --require ts-node/register --bail server/tests/api/search/index.ts
