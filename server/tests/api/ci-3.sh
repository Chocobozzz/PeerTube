#!/usr/bin/env sh

set -eu

videosFiles=$(find server/tests/api/videos -type f | grep -v index.ts | xargs echo)

npm run mocha -- --timeout 30000 --exit --require ts-node/register --require tsconfig-paths/register --bail \
    $videosFiles
