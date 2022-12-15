#!/bin/sh

set -eu

NOCLIENT=1 yarn install --pure-lockfile

rm -rf ./dist/server/tools/

(
    cd ./server/tools
    yarn install --pure-lockfile
    ../../node_modules/.bin/tsc --build --verbose
)

cp -r "./server/tools/node_modules" "./dist/server/tools"

npm run resolve-tspaths:server
