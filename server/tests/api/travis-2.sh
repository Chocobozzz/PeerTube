#!/usr/bin/env sh

set -eu

serverFiles=$(find server/tests/api/server -type f | grep -v index.ts | xargs echo)
usersFiles=$(find server/tests/api/users -type f | grep -v index.ts | xargs echo)

MOCHA_PARALLEL=true mocha --timeout 5000 --retries 3 --exit --require ts-node/register --bail \
    $serverFiles $usersFiles
