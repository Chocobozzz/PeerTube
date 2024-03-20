#!/bin/bash

set -eu

rm -rf ./dist ./packages/*/dist

npm run tsc --  -b --verbose server/tsconfig.json
npm run resolve-tspaths:server

cp -r "./server/core/static" "./server/core/assets" ./dist/core
cp "./server/scripts/upgrade.sh" "./dist/scripts"
