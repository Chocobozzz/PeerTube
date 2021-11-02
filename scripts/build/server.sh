#!/bin/bash

set -eu

rm -rf ./dist

npm run tsc -- -b --verbose
cp "./tsconfig.base.json" "./tsconfig.json" "./dist/"
cp "./scripts/tsconfig.json" "./dist/scripts/"
cp "./server/tsconfig.json" "./dist/server/"
cp "./shared/tsconfig.json" "./dist/shared/"
cp -r "./server/static" "./server/assets" "./dist/server"
cp -r "./server/lib/emails" "./dist/server/lib"
