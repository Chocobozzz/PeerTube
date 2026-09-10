#!/bin/bash

set -eu

if [ ! -f "./client/dist/en-US/index.html" ]; then
  if [ -z ${1+x} ] || [ "$1" != "--skip-client" ]; then
    echo "client/dist/en-US/index.html does not exist, compile client files..."
    npm run build:client
  fi
fi

# Copy locales
mkdir -p "./client/dist"
rm -rf "./client/dist/locale"
cp -r "./client/src/locale" "./client/dist/locale"

mkdir -p "./dist/core/lib"

npm run tsc -- -b -v --incremental server/tsconfig.json
npm run tsc-alias:server

cp -r "./server/core/static" "./server/core/assets" ./dist/core
cp -r "./server/locales" ./dist

# Lua scripts are plain assets the TypeScript build ignores; copy them next to their compiled module
mkdir -p ./dist/core/lib/redis
cp -r "./server/core/lib/redis/lua" ./dist/core/lib/redis/

./node_modules/.bin/tsc-watch --build --preserveWatchOutput --verbose --onSuccess 'sh -c "npm run tsc-alias:server && NODE_ENV=dev node --inspect --enable-source-maps dist/server"' server/tsconfig.json
