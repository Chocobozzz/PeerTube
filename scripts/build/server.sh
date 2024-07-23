#!/bin/bash

set -eu

if [ -z ${1+x} ] || [ "$1" != "--incremental" ]; then
  rm -rf ./dist ./packages/*/dist
fi

npm run tsc --  -b --verbose server/tsconfig.json
npm run resolve-tspaths:server

cp -r "./server/core/static" "./server/core/assets" ./dist/core
cp "./server/scripts/upgrade.sh" "./dist/scripts"
