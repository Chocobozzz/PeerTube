#!/bin/bash

set -eu

rm -rf ./dist ./packages/*/dist

npm run tsc --  -b --verbose server/tsconfig.json
npm run resolve-tspaths:server

cp -r "./server/server/static" "./server/server/assets" ./dist/server
cp -r "./server/server/lib/emails" "./dist/server/lib"
cp "./server/scripts/upgrade.sh" "./dist/scripts"
