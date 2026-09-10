#!/bin/bash

set -eu

if [ -z ${1+x} ] || [ "$1" != "--incremental" ]; then
  rm -rf ./dist ./packages/*/dist
fi

npm run tsc --  -b --verbose server/tsconfig.json
npm run tsc-alias:server

cp -r "./server/core/static" "./server/core/assets" ./dist/core
cp -r "./server/locales" ./dist
cp "./server/scripts/upgrade.sh" "./dist/scripts"

# Lua scripts are plain assets the TypeScript build ignores; copy them next to their compiled module
mkdir -p ./dist/core/lib/redis
cp -r "./server/core/lib/redis/lua" ./dist/core/lib/redis/

mkdir -p ./client/dist && cp -r ./client/src/assets ./client/dist
