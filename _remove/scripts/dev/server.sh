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

mkdir -p "./dist/server/lib"

npm run tsc -- -b -v --incremental
npm run resolve-tspaths:server

cp -r ./server/static ./server/assets ./dist/server
cp -r "./server/lib/emails" "./dist/server/lib"

./node_modules/.bin/tsc-watch --build --preserveWatchOutput --verbose --onSuccess 'sh -c "npm run resolve-tspaths:server && NODE_ENV=dev node dist/server"'
