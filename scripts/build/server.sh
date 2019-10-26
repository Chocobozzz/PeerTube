#!/bin/sh

set -eu

rm -rf ./dist

npm run tsc
cp "./tsconfig.json" "./dist"
cp -r "./server/static" "./server/assets" "./dist/server"
