#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Need test suite argument."
    exit -1
fi

if [ "$1" = "build_then_client" ]; then
    npm run build
    mocha --exit --require ts-node/register --bail server/tests/client.ts
elif [ "$1" = "client" ]; then
    mocha --exit --require ts-node/register --bail server/tests/client.ts
elif [ "$1" = "api" ]; then
    mocha --exit --require ts-node/register --bail server/tests/api/index.ts
elif [ "$1" = "cli" ]; then
    mocha --exit --require ts-node/register --bail server/tests/cli/index.ts
elif [ "$1" = "lint" ]; then
    cd client || exit -1
    npm run lint || exit -1

    cd .. || exit -1
    npm run tslint -- --type-check --project ./tsconfig.json -c ./tslint.json server.ts "server/**/*.ts" || exit -1
fi
