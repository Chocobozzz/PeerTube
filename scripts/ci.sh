#!/bin/bash

set -eu

if [ $# -eq 0 ]; then
    echo "Need test suite argument."
    exit -1
fi

retries=3
speedFactor="${2:-1}"

runTest () {
    jobname=$1
    shift

    jobs=$1
    shift

    files=$@

    echo $files

    joblog="$jobname-ci.log"

    parallel -j $jobs --retries $retries \
        "echo Trying {} >> $joblog; npm run mocha -- -c --timeout 30000 --exit --bail {}" \
        ::: $files

    cat "$joblog" | sort | uniq -c
    rm "$joblog"
}

findTestFiles () {
    exception="-not -name index.js"

    if [ ! -z ${2+x} ]; then
        exception="$exception -not -name $2"
    fi

    find $1 -type f -name "*.js" $exception | xargs echo
}

if [ "$1" = "types-package" ]; then
    npm run generate-types-package 0.0.0
    npm run tsc -- --noEmit --esModuleInterop packages/types/tests/test.ts
elif [ "$1" = "client" ]; then
    npm run build

    feedsFiles=$(findTestFiles ./dist/server/tests/feeds)
    helperFiles=$(findTestFiles ./dist/server/tests/helpers)
    libFiles=$(findTestFiles ./dist/server/tests/lib)
    miscFiles="./dist/server/tests/client.js ./dist/server/tests/misc-endpoints.js"
    # Not in their own task, they need an index.html
    pluginFiles="./dist/server/tests/plugins/html-injection.js ./dist/server/tests/api/server/plugins.js"

    MOCHA_PARALLEL=true runTest "$1" $((2*$speedFactor)) $feedsFiles $helperFiles $miscFiles $pluginFiles $libFiles
elif [ "$1" = "cli-plugin" ]; then
    # Simulate HTML
    mkdir -p "./client/dist/en-US/"
    cp "./client/src/index.html" "./client/dist/en-US/index.html"

    npm run build:server
    npm run setup:cli

    pluginsFiles=$(findTestFiles ./dist/server/tests/plugins html-injection.js)
    cliFiles=$(findTestFiles ./dist/server/tests/cli)

    MOCHA_PARALLEL=true runTest "$1" $((2*$speedFactor)) $pluginsFiles
    runTest "$1" 1 $cliFiles
elif [ "$1" = "api-1" ]; then
    npm run build:server

    checkParamFiles=$(findTestFiles ./dist/server/tests/api/check-params)
    notificationsFiles=$(findTestFiles ./dist/server/tests/api/notifications)
    searchFiles=$(findTestFiles ./dist/server/tests/api/search)

    MOCHA_PARALLEL=true runTest "$1" $((3*$speedFactor)) $notificationsFiles $searchFiles $checkParamFiles
elif [ "$1" = "api-2" ]; then
    npm run build:server

    liveFiles=$(findTestFiles ./dist/server/tests/api/live)
    serverFiles=$(findTestFiles ./dist/server/tests/api/server plugins.js)
    usersFiles=$(findTestFiles ./dist/server/tests/api/users)

    MOCHA_PARALLEL=true runTest "$1" $((3*$speedFactor)) $liveFiles $serverFiles $usersFiles
elif [ "$1" = "api-3" ]; then
    npm run build:server

    videosFiles=$(findTestFiles ./dist/server/tests/api/videos)
    viewsFiles=$(findTestFiles ./dist/server/tests/api/views)

    MOCHA_PARALLEL=true runTest "$1" $((3*$speedFactor)) $viewsFiles $videosFiles
elif [ "$1" = "api-4" ]; then
    npm run build:server

    moderationFiles=$(findTestFiles ./dist/server/tests/api/moderation)
    redundancyFiles=$(findTestFiles ./dist/server/tests/api/redundancy)
    objectStorageFiles=$(findTestFiles ./dist/server/tests/api/object-storage)
    activitypubFiles=$(findTestFiles ./dist/server/tests/api/activitypub)

    MOCHA_PARALLEL=true runTest "$1" $((2*$speedFactor)) $moderationFiles $redundancyFiles $activitypubFiles $objectStorageFiles
elif [ "$1" = "api-5" ]; then
    npm run build:server

    transcodingFiles=$(findTestFiles ./dist/server/tests/api/transcoding)

    MOCHA_PARALLEL=true runTest "$1" $((2*$speedFactor)) $transcodingFiles
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
