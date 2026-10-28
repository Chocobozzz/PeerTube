#!/bin/bash

set -eu

if [ $# -eq 0 ]; then
    echo "Need test suite argument."
    exit -1
fi

retries=3
speedFactor="${2:-1}"


durationsFile="./scripts/ci/test-durations.txt"
defaultDuration=180

# Output example:
#   521 ./packages/tests/dist/api/transcoding/video-studio.js
#   180 ./packages/tests/dist/api/transcoding/new-test.js
#   171 ./packages/tests/dist/api/transcoding/hls.js
#   ...
withDurations () {
    printf '%s\n' "$@" | awk -v durationsFile="$durationsFile" -v defaultDuration=$defaultDuration '
        BEGIN { while ((getline line < durationsFile) > 0) { split(line, a, " "); durations[a[1]] = a[2] } }
        {
            key = $0
            sub(/^\.\/packages\/tests\/(dist|src)\//, "", key)
            sub(/\.(js|ts)$/, "", key)

            print (key in durations ? durations[key] : defaultDuration), $0
        }' | sort -k1,1nr -k2,2
}

# Longest files first
sortByDuration () {
    withDurations "$@" | cut -d ' ' -f 2 | xargs echo
}

# Split files in shards of similar durations
#
# Each file, longest first, goes to the shard with the lowest total duration so far
# Example output (with shard 1 = 521s):
#   ./packages/tests/dist/api/transcoding/video-studio.js
# And (with shard 2 = 171 + 152 + 24 = 347s):
#   ./packages/tests/dist/api/transcoding/hls.js ./packages/tests/dist/api/transcoding/transcoder.js ./packages/tests/dist/api/transcoding/audio-only.js
shardFiles () {
    shard=$1
    shift

    shardCount=$1
    shift

    withDurations "$@" | awk -v shard=$shard -v shardCount=$shardCount '
        {
            min = 1
            for (i = 2; i <= shardCount; i++) if (loads[i] < loads[min]) min = i

            loads[min] += $1
            if (min == shard) print $2
        }' | xargs echo
}

runMochaFile () {
    file=$1

    echo "Trying $file" >> "$triesLog"

    output=$(mktemp)
    npm run mocha -- --timeout 30000 --no-config -c --exit --bail "$file" > "$output" 2>&1 && code=0 || code=$?
    cat "$output"

    if [ $code -ne 0 ]; then
        mkdir -p artifacts/failed-attempts
        cp "$output" "artifacts/failed-attempts/$(basename "$file")-$(date +%s).log"
    fi

    rm "$output"
    return $code
}
export -f runMochaFile

runJSTest () {
    jobname=$1
    shift

    jobs=$1
    shift

    files=$(sortByDuration "$@")

    echo $files

    export triesLog="$jobname-ci.log"
    joblog="$jobname-ci-joblog.log"

    parallel -j $jobs --retries $retries --joblog "$joblog" runMochaFile ::: $files

    cat "$triesLog" | sort | uniq -c
    rm "$triesLog"

    # Print the duration of each test file, parsed by ./scripts/ci/update-test-durations.sh
    # $joblog is a TSV file with a header line. 4th column is the job duration in seconds, 9th is the command
    # Example of $joblog line:
    #   3	:	1793173119.512	   392.734	0	1838	0	0	runMochaFile ./packages/tests/dist/api/redundancy/redundancy.js
    # Output:
    #   [test-duration] api/redundancy/redundancy 393
    awk -F '\t' 'NR > 1 {
        n = split($9, a, " ")
        key = a[n]
        sub(/^\.\/packages\/tests\/(dist|src)\//, "", key)
        sub(/\.(js|ts)$/, "", key)

        print "[test-duration]", key, int($4 + 0.5)
    }' "$joblog"
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
    (cd /tmp/types-generator/tests && npx --package typescript tsc --noEmit --module commonjs --esModuleInterop ./test.ts)

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
elif [ "$1" = "api-check-params-search" ]; then
    npm run build:server
    npm run build:tests

    checkParamFiles=$(findTestFiles ./packages/tests/dist/api/check-params)
    searchFiles=$(findTestFiles ./packages/tests/dist/api/search)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $checkParamFiles $searchFiles
elif [ "$1" = "api-videos-1" ] || [ "$1" = "api-videos-2" ]; then
    npm run build:server
    npm run build:tests

    videosFiles=$(findTestFiles ./packages/tests/dist/api/videos)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $(shardFiles ${1##*-} 2 $videosFiles)
elif [ "$1" = "api-server" ]; then
    npm run build:server
    npm run build:tests

    # plugins test needs an HTML file
    serverFiles=$(findTestFiles ./packages/tests/dist/api/server plugins.js)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $serverFiles
elif [ "$1" = "api-live-scalability" ]; then
    npm run build:server
    npm run build:tests

    liveFiles=$(findTestFiles ./packages/tests/dist/api/live)
    horizontalScalabilityFiles=$(findTestFiles ./packages/tests/dist/api/horizontal-scalability)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $liveFiles $horizontalScalabilityFiles
elif [ "$1" = "api-users-stats" ]; then
    npm run build:server
    npm run build:tests

    usersFiles=$(findTestFiles ./packages/tests/dist/api/users)
    statsFiles=$(findTestFiles ./packages/tests/dist/api/stats)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $usersFiles $statsFiles
elif [ "$1" = "api-moderation-notifications" ]; then
    npm run build:server
    npm run build:tests

    moderationFiles=$(findTestFiles ./packages/tests/dist/api/moderation)
    notificationsFiles=$(findTestFiles ./packages/tests/dist/api/notifications)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $moderationFiles $notificationsFiles
elif [ "$1" = "api-federation" ]; then
    npm run build:server
    npm run build:tests

    activitypubFiles=$(findTestFiles ./packages/tests/dist/api/activitypub)
    redundancyFiles=$(findTestFiles ./packages/tests/dist/api/redundancy)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $activitypubFiles $redundancyFiles
elif [ "$1" = "api-object-storage" ]; then
    npm run build:server
    npm run build:tests

    objectStorageFiles=$(findTestFiles ./packages/tests/dist/api/object-storage)

    MOCHA_PARALLEL=true runJSTest "$1" $((2*$speedFactor)) $objectStorageFiles
elif [ "$1" = "api-transcoding-1" ] || [ "$1" = "api-transcoding-2" ]; then
    npm run build:server
    npm run build:tests

    transcodingFiles=$(findTestFiles ./packages/tests/dist/api/transcoding)
    runnersFiles=$(findTestFiles ./packages/tests/dist/api/runners)

    MOCHA_PARALLEL=true runJSTest "$1" $((2*$speedFactor)) $(shardFiles ${1##*-} 2 $transcodingFiles $runnersFiles)
elif [ "$1" = "external-plugins" ]; then
    pnpm run --filter=@peertube/tests install-dependencies:transcription

    npm run build:server
    npm run build:tests
    npm run build:peertube-runner

    externalPluginsFiles=$(findTestFiles ./packages/tests/dist/external-plugins)
    peertubeRunnerFiles=$(findTestFiles ./packages/tests/dist/peertube-runner)

    runJSTest "$1" 1 $externalPluginsFiles
    MOCHA_PARALLEL=true runJSTest "$1" $((2*$speedFactor)) $peertubeRunnerFiles
elif [ "$1" = "lint" ]; then
    npm run oxlint -- --import-plugin --promise-plugin --node-plugin

    npm run swagger-cli -- validate support/doc/api/openapi.yaml

    npm run generate-config-schema
    git diff --exit-code config/config-schema.json || \
        { echo "config/config-schema.json is stale. Run 'npm run generate-config-schema' and commit the result."; exit 1; }

    npm run validate-config-schema

    ( cd client && npm run lint )
elif [ "$1" = "transcription" ]; then
    pnpm run --filter=@peertube/tests install-dependencies:transcription

    npm run build:server
    npm run build:tests

    transcriptionFiles=$(findTestFiles ./packages/tests/dist/transcription)
    transcriptionDevToolsFiles=$(findTestFiles ./packages/tests/dist/transcription-devtools)

    MOCHA_PARALLEL=true runJSTest "$1" $((3*$speedFactor)) $transcriptionFiles $transcriptionDevToolsFiles
else
    echo "Unknown suite: $1"
    exit 1
fi
