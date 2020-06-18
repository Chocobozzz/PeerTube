#!/bin/sh

set -eu

if [ $# -eq 0 ]; then
    echo "Need test suite argument."
    exit -1
fi

killall -q peertube || true

perl -0777 -i  -pe 's#proxy:(\n\s+)enabled: false\n\s+url: ""#proxy:$1enabled: true$1url: "http://188.165.225.149:7899"#' config/test.yaml

if [ "$1" = "misc" ]; then
    npm run build -- --light
    TS_NODE_FILES=true mocha --timeout 5000 --exit --require ts-node/register --require tsconfig-paths/register --bail \
        server/tests/client.ts \
        server/tests/feeds/index.ts \
        server/tests/misc-endpoints.ts \
        server/tests/helpers/index.ts \
        server/tests/plugins/index.ts
elif [ "$1" = "cli" ]; then
    npm run build:server
    CC=gcc-4.9 CXX=g++-4.9 npm run setup:cli
    mocha --timeout 5000 --exit --require ts-node/register --require tsconfig-paths/register --bail server/tests/cli/index.ts
elif [ "$1" = "api-1" ]; then
    npm run build:server
    sh ./server/tests/api/ci-1.sh 2
elif [ "$1" = "api-2" ]; then
    npm run build:server
    sh ./server/tests/api/ci-2.sh 2
elif [ "$1" = "api-3" ]; then
    npm run build:server
    sh ./server/tests/api/ci-3.sh 2
elif [ "$1" = "api-4" ]; then
    npm run build:server
    sh ./server/tests/api/ci-4.sh 2
elif [ "$1" = "external-plugins" ]; then
    npm run build:server
    mocha --timeout 5000 --exit --require ts-node/register --require tsconfig-paths/register --bail server/tests/external-plugins/index.ts
elif [ "$1" = "lint" ]; then
    npm run eslint -- --ext .ts "server/**/*.ts" "shared/**/*.ts"
    npm run swagger-cli -- validate support/doc/api/openapi.yaml

    ( cd client
      npm run lint
    )
fi

git checkout -- config/test.yaml
