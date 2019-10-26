#!/bin/sh

set -eu

# Copy locales
mkdir -p "./client/dist"
rm -rf "./client/dist/locale"
cp -r "./client/src/locale/target" "./client/dist/locale"

rm -rf "./dist"

mkdir "./dist"
cp "./tsconfig.json" "./dist"

NODE_ENV=test npm run concurrently -- -k \
  "npm run tsc -- --sourceMap && cp -r ./server/static ./server/assets ./dist/server && npm run nodemon -- --delay 2 --watch ./dist dist/server" \
  "npm run tsc -- --sourceMap --preserveWatchOutput -w"
