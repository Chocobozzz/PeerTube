#!/usr/bin/env sh

set -eu

videosFiles=$(find server/tests/api/videos -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true mocha --timeout 5000 --retries 3 --exit --require ts-node/register --bail \
    $videosFiles
