#!/bin/sh

set -eu

if [ ! -f "./client/dist/en-US/index.html" ]; then
  echo "client/dist/en-US/index.html does not exist, compile client files..."
  npm run build:client -- --light
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

NODE_ENV=test npm run concurrently -- -k \
  "npm run nodemon -- --delay 1 --watch ./dist dist/server" \
  "npm run tsc -- --incremental --sourceMap --preserveWatchOutput -w"
