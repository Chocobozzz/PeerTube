#!/bin/bash

set -eu

if [ ! -f "./client/dist/en-US/index.html" ]; then
  if [ -z ${1+x} ] || [ "$1" != "--skip-client" ]; then
    echo "client/dist/en-US/index.html does not exist, compile client files..."
    npm run build:client -- --light
  fi
fi

# Copy locales
mkdir -p "./client/dist"
rm -rf "./client/dist/locale"
cp -r "./client/src/locale" "./client/dist/locale"

rm -rf "./dist"

mkdir "./dist"
cp "./tsconfig.json" "./dist"

npm run tsc -- --incremental --sourceMap
cp -r ./server/static ./server/assets ./dist/server
cp -r "./server/lib/emails" "./dist/server/lib"

NODE_ENV=test node node_modules/.bin/concurrently -k \
  "node_modules/.bin/nodemon --delay 1 --watch ./dist dist/server" \
  "node_modules/.bin/tsc --incremental --sourceMap --preserveWatchOutput -w"
