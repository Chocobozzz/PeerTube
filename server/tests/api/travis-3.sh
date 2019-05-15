#!/usr/bin/env sh

set -eu

videosFiles=$(find server/tests/api/videos -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true mocha-parallel-tests --max-parallel $1 --timeout 5000 --exit --require ts-node/register --bail \
    $videosFiles
