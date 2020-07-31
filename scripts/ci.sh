#!/bin/bash

set -eu

if [ $# -eq 0 ]; then
    echo "Need test suite argument."
    exit -1
fi

killall -q peertube || true

retries=3
jobs=2

runTest () {
    retries=3
    jobs=$1
    shift
    files=$@

    echo $files

    parallel -t -j $jobs --retries $retries \
        npm run mocha -- -c --timeout 30000 --exit --require ts-node/register --require tsconfig-paths/register --bail \
        ::: $files
}

findTestFiles () {
    find $1 -type f -name "*.ts" | grep -v index.ts | xargs echo
}

if [ "$1" = "misc" ]; then
    npm run build -- --light

    feedsFiles=$(findTestFiles server/tests/feeds)
    helperFiles=$(findTestFiles server/tests/helpers)
    pluginsFiles=$(findTestFiles server/tests/plugins)
    miscFiles="server/tests/client.ts server/tests/misc-endpoints.ts"

    TS_NODE_FILES=true runTest 1 $feedsFiles $helperFiles $pluginsFiles $miscFiles
elif [ "$1" = "cli" ]; then
    npm run build:server
    npm run setup:cli

    cliFiles=$(findTestFiles server/tests/cli)

    runTest 1 $cliFiles
elif [ "$1" = "api-1" ]; then
    npm run build:server

    checkParamFiles=$(findTestFiles server/tests/api/check-params)
    notificationsFiles=$(findTestFiles server/tests/api/notifications)
    searchFiles=$(findTestFiles server/tests/api/search)

    MOCHA_PARALLEL=true runTest 2 $notificationsFiles $searchFiles $checkParamFiles
elif [ "$1" = "api-2" ]; then
    npm run build:server

    serverFiles=$(findTestFiles server/tests/api/server)
    usersFiles=$(findTestFiles server/tests/api/users)

    MOCHA_PARALLEL=true runTest 2 $serverFiles $usersFiles
elif [ "$1" = "api-3" ]; then
    npm run build:server

    videosFiles=$(findTestFiles server/tests/api/videos)

    MOCHA_PARALLEL=true runTest 2 $videosFiles
elif [ "$1" = "api-4" ]; then
    npm run build:server

    activitypubFiles=$(findTestFiles server/tests/api/moderation)
    redundancyFiles=$(findTestFiles server/tests/api/redundancy)
    activitypubFiles=$(findTestFiles server/tests/api/activitypub)

    MOCHA_PARALLEL=true TS_NODE_FILES=true runTest 2 $activitypubFiles $redundancyFiles $activitypubFiles
elif [ "$1" = "external-plugins" ]; then
    npm run build:server

    externalPluginsFiles=$(findTestFiles server/tests/external-plugins)

    runTest 1 $externalPluginsFiles
elif [ "$1" = "lint" ]; then
    npm run eslint -- --ext .ts "server/**/*.ts" "shared/**/*.ts" "scripts/**/*.ts"
    npm run swagger-cli -- validate support/doc/api/openapi.yaml

    ( cd client
      npm run lint
    )
fi
