#!/bin/sh

set -eu

# Copy locales
mkdir -p "./client/dist"
rm -rf "./client/dist/locale"
cp -r "./client/src/locale/target" "./client/dist/locale"

rm -r "./dist"

NODE_ENV=test npm run concurrently -- -k \
  "npm run tsc -- --sourceMap && npm run nodemon -- --delay 2 --watch ./dist dist/server" \
  "npm run tsc -- --sourceMap --preserveWatchOutput -w"
