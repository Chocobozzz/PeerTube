#!/usr/bin/env sh

set -eu

redundancyFiles=$(find server/tests/api/redundancy -type f | grep -v index.ts | xargs echo)
activitypubFiles=$(find server/tests/api/activitypub -type f | grep -v index.ts | xargs echo)

TS_NODE_FILES=true MOCHA_PARALLEL=true npm run mocha -- --parallel --jobs $1 --timeout 30000 --exit \
  --require ts-node/register --require tsconfig-paths/register --bail \
  $redundancyFiles $activitypubFiles
