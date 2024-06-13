#!/bin/bash

set -eu

if [ $# -eq 0 ]; then
    echo "Need test suite argument."
    exit -1
fi

retries=3
speedFactor="${2:-1}"

runJSTest () {
    jobname=$1
    shift

    jobs=$1
    shift

    files=$@

    echo $files

    joblog="$jobname-ci.log"

    parallel -j $jobs --retries $retries \
        "echo Trying {} >> $joblog; npm run mocha -- --timeout 30000 --no-config -c --exit --bail {}" \
        ::: $files

    cat "$joblog" | sort | uniq -c
    rm "$joblog"
}

findTestFiles () {
    exception="-not -name index.js -not -name index.ts -not -name *.d.ts"

    if [ ! -z ${2+x} ]; then
        exception="$exception -not -name $2"
    fi

    find $1 -type f \( -name "*.js" -o -name "*.ts" \) $exception | xargs echo
}

if [ "$1" = "types-package" ]; then
    npm run generate-types-package 0.0.0

    # Test on in independent directory
    rm -fr /tmp/types-generator
    mkdir -p /tmp/types-generator
    cp -r packages/types-generator/tests /tmp/types-generator/tests
    cp -r packages/types-generator/dist /tmp/types-generator/dist
    (cd /tmp/types-generator/dist && npm install)

    npm run tsc -- --noEmit --esModuleInterop --moduleResolution node16 --module Node16 /tmp/types-generator/tests/test.ts
    rm -r /tmp/types-generator
elif [ "$1" = "client" ]; then
    npm run build
    npm run build:tests

    feedsFiles=$(findTestFiles ./packages/tests/dist/feeds)
    clientFiles=$(findTestFiles ./packages/tests/dist/client)
    miscFiles="./packages/tests/dist/misc-endpoints.js ./packages/tests/dist/nginx.js"
    # Not in their own task, they need an index.html
    pluginFiles="./packages/tests/dist/plugins/html-injection.js ./packages/tests/dist/api/server/plugins.js"

    MOCHA_PARALLEL=true runJSTest "$1" $((2*$speedFactor)) $feedsFiles $miscFiles $pluginFiles $clientFiles

    # Use TS tests directly because we import server files
    helperFiles=$(findTestFiles ./packages/tests/src/server-helpers)
    libFiles=$(findTestFiles ./packages/tests/src/server-lib)

    npm run mocha -- --timeout 30000 -c --exit --bail $libFiles $helperFiles
elif [ "$1" = "cli-plugin" ]; then
    # Simulate HTML
    mkdir -p "./client/dist/en-US/"
    cp "./client/src/index.html" "./client/dist/en-US/index.html"

    npm run build:server
    npm run build:tests
    npm run build:peertube-cli

    # html-injection test needs an HTML file
    pluginsFiles=$(findTestFiles ./packages/tests/dist/plugins html-injection.js)
    cliFiles=$(findTestFiles ./packages/tests/dist/cli)

    MOCHA_PARALLEL=true runJSTest "$1" $((2*$speedFactor)) $pluginsFiles
    runJSTest "$1" 1 $cliFiles
elif [ "$1" = "api-1" ]; then
    npm run build:server
    npm run build:tests

    checkParamFiles=$(findTestFiles ./packages/tests/dist/api/check-params)
    notificationsFiles=$(findTestFiles ./packages/tests/dist/api/notifications)
    searchFiles=$(findTestFiles ./packages/tests/dist/api/search)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $notificationsFiles $searchFiles $checkParamFiles
elif [ "$1" = "api-2" ]; then
    npm run build:server
    npm run build:tests

    liveFiles=$(findTestFiles ./packages/tests/dist/api/live)
    # plugins test needs an HTML file
    serverFiles=$(findTestFiles ./packages/tests/dist/api/server plugins.js)
    usersFiles=$(findTestFiles ./packages/tests/dist/api/users)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $liveFiles $serverFiles $usersFiles
elif [ "$1" = "api-3" ]; then
    npm run build:server
    npm run build:tests

    videosFiles=$(findTestFiles ./packages/tests/dist/api/videos)
    viewsFiles=$(findTestFiles ./packages/tests/dist/api/views)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $viewsFiles $videosFiles
elif [ "$1" = "api-4" ]; then
    npm run build:server
    npm run build:tests

    moderationFiles=$(findTestFiles ./packages/tests/dist/api/moderation)
    redundancyFiles=$(findTestFiles ./packages/tests/dist/api/redundancy)
    objectStorageFiles=$(findTestFiles ./packages/tests/dist/api/object-storage)
    activitypubFiles=$(findTestFiles ./packages/tests/dist/api/activitypub)

    MOCHA_PARALLEL=true runJSTest "$1" $((2*$speedFactor)) $moderationFiles $redundancyFiles $activitypubFiles $objectStorageFiles
elif [ "$1" = "api-5" ]; then
    npm run build:server
    npm run build:tests

    transcodingFiles=$(findTestFiles ./packages/tests/dist/api/transcoding)
    runnersFiles=$(findTestFiles ./packages/tests/dist/api/runners)

    MOCHA_PARALLEL=true runJSTest "$1" $((2*$speedFactor)) $transcodingFiles $runnersFiles
elif [ "$1" = "external-plugins" ]; then
    npm run install-dependencies:transcription --workspace=@peertube/tests

    npm run build:server
    npm run build:tests
    npm run build:peertube-runner

    externalPluginsFiles=$(findTestFiles ./packages/tests/dist/external-plugins)
    peertubeRunnerFiles=$(findTestFiles ./packages/tests/dist/peertube-runner)

    runJSTest "$1" 1 $externalPluginsFiles
    MOCHA_PARALLEL=true runJSTest "$1" $((2*$speedFactor)) $peertubeRunnerFiles
elif [ "$1" = "lint" ]; then
    npm run eslint -- --ext .ts "server/**/*.ts"  "scripts/**/*.ts" "packages/**/*.ts" "apps/**/*.ts"

    npm run swagger-cli -- validate support/doc/api/openapi.yaml

    ( cd client && npm run lint )
elif [ "$1" = "transcription" ]; then
    npm run install-dependencies:transcription --workspace=@peertube/tests

    npm run build:server
    npm run build:tests

    transcriptionFiles=$(findTestFiles ./packages/tests/dist/transcription)
    transcriptionDevToolsFiles=$(findTestFiles ./packages/tests/dist/transcription-devtools)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $transcriptionFiles $transcriptionDevToolsFiles
fi
