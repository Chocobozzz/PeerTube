#!/usr/bin/env sh

set -eu

notificationsFiles=$(find server/tests/api/notifications -type f | grep -v index.ts | xargs echo)
searchFiles=$(find server/tests/api/search -type f | grep -v index.ts | xargs echo)
checkParamFiles=$(find server/tests/api/check-params -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true mocha-parallel-tests --max-parallel 4 --timeout 5000 --exit --require ts-node/register --bail \
    $notificationsFiles $searchFiles $checkParamFiles
