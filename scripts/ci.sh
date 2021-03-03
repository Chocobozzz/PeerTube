#!/bin/bash

set -eu

[ "$#" -eq 0 ] && { echo 'Need test suite argument.'; exit -1 ;}

killall -q peertube || true

retries=3

runTest () {
    jobname="$1"
    shift

    jobs="$1"
    shift

    files="$@"

    echo "$files"

    joblog="$jobname-ci.log"

    parallel -j $jobs --retries $retries \
        "echo Trying {} >> $joblog; npm run mocha -- -c --timeout 30000 --exit --require ts-node/register --require tsconfig-paths/register --bail {}" \
        ::: $files

    cat "$joblog" | uniq -c
    rm "$joblog"
}

findTestFiles () {
    find $1 -type f -name "*.ts" | grep -v "/index.ts" | xargs echo
}


case "$1" in 
misc)   
    npm run build

    feedsFiles=$(findTestFiles server/tests/feeds)
    helperFiles=$(findTestFiles server/tests/helpers)
    pluginsFiles=$(findTestFiles server/tests/plugins)
    miscFiles='server/tests/client.ts server/tests/misc-endpoints.ts'

    TS_NODE_FILES=true runTest "$1" 1 $feedsFiles $helperFiles $pluginsFiles $miscFiles
;;

cli)
    pm run build:server
    npm run setup:cli
    cliFiles=$(findTestFiles server/tests/cli)
    runTest "$1" 1 $cliFiles
;;

api-1)
    npm run build:server

    checkParamFiles=$(findTestFiles server/tests/api/check-params)
    notificationsFiles=$(findTestFiles server/tests/api/notifications)
    searchFiles=$(findTestFiles server/tests/api/search)

    MOCHA_PARALLEL=true runTest "$1" 3 $notificationsFiles $searchFiles $checkParamFiles
;;

api-2)
    npm run build:server

    serverFiles=$(findTestFiles server/tests/api/server)
    usersFiles=$(findTestFiles server/tests/api/users)
    liveFiles=$(findTestFiles server/tests/api/live)

    MOCHA_PARALLEL=true runTest "$1" 3 $serverFiles $usersFiles $liveFiles
;;

api-3)
    npm run build:server

    videosFiles=$(findTestFiles server/tests/api/videos)

    MOCHA_PARALLEL=true runTest "$1" 3 $videosFiles
;;

api-4)
    npm run build:server

    activitypubFiles=$(findTestFiles server/tests/api/moderation)
    redundancyFiles=$(findTestFiles server/tests/api/redundancy)
    activitypubFiles=$(findTestFiles server/tests/api/activitypub)

    MOCHA_PARALLEL=true TS_NODE_FILES=true runTest "$1" 2 $activitypubFiles $redundancyFiles $activitypubFiles
;;

external-plugins)
    npm run build:server

    externalPluginsFiles=$(findTestFiles server/tests/external-plugins)

    runTest "$1" 1 $externalPluginsFiles
;;

lint)
    pm run eslint -- --ext .ts "server/**/*.ts" "shared/**/*.ts" "scripts/**/*.ts"
    npm run swagger-cli -- validate support/doc/api/openapi.yaml

    ( cd client
      npm run lint
    )
;;
esac
