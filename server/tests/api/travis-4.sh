#!/usr/bin/env sh

set -eu

redundancyFiles=$(find server/tests/api/redundancy -type f | grep -v index.ts | xargs echo)
activitypubFiles=$(find server/tests/api/activitypub -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true mocha-parallel-tests --max-parallel $1 --timeout 5000 --retries 3 --exit --require ts-node/register --bail \
    $redundancyFiles $activitypubFiles
