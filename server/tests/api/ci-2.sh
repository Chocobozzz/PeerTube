#!/usr/bin/env sh

set -eu

serverFiles=$(find server/tests/api/server -type f | grep -v index.ts | xargs echo)
usersFiles=$(find server/tests/api/users -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true npm run mocha -- --parallel --jobs $1 --timeout 30000 --exit \
  --require ts-node/register --require tsconfig-paths/register --bail \
  $serverFiles $usersFiles
