#!/bin/bash

set -eu

rm -rf ./dist/server/tools/

(
    cd ./server/tools
    yarn install --pure-lockfile
)

mkdir -p "./dist/server/tools"
cp -r "./server/tools/node_modules" "./dist/server/tools"

cd ./server/tools
../../node_modules/.bin/tsc-watch --build --verbose --onSuccess 'sh -c "cd ../../ && npm run resolve-tspaths:server"'
