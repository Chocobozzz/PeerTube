#!/usr/bin/env sh

set -eu

checkParamFiles=$(find server/tests/api/check-params -type f | grep -v index.ts | xargs echo)
notificationsFiles=$(find server/tests/api/notifications -type f | grep -v index.ts | xargs echo)
searchFiles=$(find server/tests/api/search -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true mocha --timeout 5000 --retries 3 --exit --require ts-node/register --bail \
    $notificationsFiles $searchFiles $checkParamFiles
