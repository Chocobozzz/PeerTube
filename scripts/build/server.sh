#!/bin/sh

set -eu

rm -rf ./dist

npm run tsc
cp -r "./server/static" "./dist/server"
