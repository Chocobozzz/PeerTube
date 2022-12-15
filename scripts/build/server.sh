#!/bin/bash

set -eu

rm -rf ./dist

npm run tsc -- -b --verbose
npm run resolve-tspaths:server

cp -r "./server/static" "./server/assets" "./dist/server"
cp -r "./server/lib/emails" "./dist/server/lib"
