#!/bin/sh

set -eu

if [ $# -eq 0 ]; then
    echo "Need test suite argument."
    exit -1
fi

killall -q peertube || true

if [ "$1" = "misc" ]; then
    npm run build
    mocha --timeout 5000 --exit --require ts-node/register/type-check --bail server/tests/client.ts server/tests/activitypub.ts \
        server/tests/feeds/index.ts
elif [ "$1" = "api" ]; then
    npm run build:server
    mocha --timeout 5000 --exit --require ts-node/register/type-check --bail server/tests/api/index.ts
elif [ "$1" = "cli" ]; then
    npm run build:server
    mocha --timeout 5000 --exit --require ts-node/register/type-check --bail server/tests/cli/index.ts
elif [ "$1" = "api-1" ]; then
    npm run build:server
    mocha --timeout 5000 --exit --require ts-node/register/type-check --bail server/tests/api/index-1.ts
elif [ "$1" = "api-2" ]; then
    npm run build:server
    mocha --timeout 5000 --exit --require ts-node/register/type-check --bail server/tests/api/index-2.ts
elif [ "$1" = "api-3" ]; then
    npm run build:server
    mocha --timeout 5000 --exit --require ts-node/register/type-check --bail server/tests/api/index-3.ts
elif [ "$1" = "lint" ]; then
    ( cd client
      npm run lint
    )

    npm run tslint -- --project ./tsconfig.json -c ./tslint.json server.ts "server/**/*.ts" "shared/**/*.ts"
fi
