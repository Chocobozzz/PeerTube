#!/bin/bash

set -eu

if [ $# -eq 0 ]; then
    echo "Need test suite argument."
    exit -1
fi

killall -q peertube || true

retries=3

runTest () {
    jobname=$1
    shift

    jobs=$1
    shift

    files=$@

    echo $files

    joblog="$jobname-ci.log"

    parallel -j $jobs --retries $retries \
        "echo Trying {} >> $joblog; npm run mocha -- -c --timeout 30000 --exit --require ./dist/server/tests/register.js --bail {}" \
        ::: $files

    cat "$joblog" | uniq -c
    rm "$joblog"
}

findTestFiles () {
    exception="-not -name index.js"

    if [ ! -z ${2+x} ]; then
        exception="$exception -not -name $2"
    fi

    find $1 -type f -name "*.js" $exception | xargs echo
}

if [ "$1" = "client" ]; then
    npm run build

    feedsFiles=$(findTestFiles ./dist/server/tests/feeds)
    helperFiles=$(findTestFiles ./dist/server/tests/helpers)
    miscFiles="./dist/server/tests/client.js ./dist/server/tests/misc-endpoints.js"
    # Not in plugin task, it needs an index.html
    pluginFiles="./dist/server/tests/plugins/html-injection.js"

    MOCHA_PARALLEL=true runTest "$1" 2 $feedsFiles $helperFiles $miscFiles $pluginFiles
elif [ "$1" = "cli-plugin" ]; then
    npm run build:server
    npm run setup:cli

    pluginsFiles=$(findTestFiles ./dist/server/tests/plugins html-injection.js)
    cliFiles=$(findTestFiles ./dist/server/tests/cli)

    MOCHA_PARALLEL=true runTest "$1" 2 $pluginsFiles
    runTest "$1" 1 $cliFiles
elif [ "$1" = "api-1" ]; then
    npm run build:server

    checkParamFiles=$(findTestFiles ./dist/server/tests/api/check-params)
    notificationsFiles=$(findTestFiles ./dist/server/tests/api/notifications)
    searchFiles=$(findTestFiles ./dist/server/tests/api/search)

    MOCHA_PARALLEL=true runTest "$1" 3 $notificationsFiles $searchFiles $checkParamFiles
elif [ "$1" = "api-2" ]; then
    npm run build:server

    liveFiles=$(findTestFiles ./dist/server/tests/api/live)
    serverFiles=$(findTestFiles ./dist/server/tests/api/server)
    usersFiles=$(findTestFiles ./dist/server/tests/api/users)

    MOCHA_PARALLEL=true runTest "$1" 3 $serverFiles $usersFiles $liveFiles
elif [ "$1" = "api-3" ]; then
    npm run build:server

    videosFiles=$(findTestFiles ./dist/server/tests/api/videos)

    MOCHA_PARALLEL=true runTest "$1" 3 $videosFiles
elif [ "$1" = "api-4" ]; then
    npm run build:server

    moderationFiles=$(findTestFiles ./dist/server/tests/api/moderation)
    redundancyFiles=$(findTestFiles ./dist/server/tests/api/redundancy)
    activitypubFiles=$(findTestFiles ./dist/server/tests/api/activitypub)

    MOCHA_PARALLEL=true TS_NODE_FILES=true runTest "$1" 2 $moderationFiles $redundancyFiles $activitypubFiles
elif [ "$1" = "external-plugins" ]; then
    npm run build:server

    externalPluginsFiles=$(findTestFiles ./dist/server/tests/external-plugins)

    runTest "$1" 1 $externalPluginsFiles
elif [ "$1" = "lint" ]; then
    npm run eslint -- --ext .ts "./server/**/*.ts" "shared/**/*.ts" "scripts/**/*.ts"
    npm run swagger-cli -- validate support/doc/api/openapi.yaml

    ( cd client
      npm run lint
    )
fi
