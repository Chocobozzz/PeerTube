#!/usr/bin/env sh

set -eu

checkParamFiles=$(find server/tests/api/check-params -type f | grep -v index.ts | xargs echo)
notificationsFiles=$(find server/tests/api/notifications -type f | grep -v index.ts | xargs echo)
searchFiles=$(find server/tests/api/search -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true npm run mocha -- --timeout 30000 --exit --require ts-node/register --require tsconfig-paths/register --bail \
    $notificationsFiles $searchFiles $checkParamFiles
