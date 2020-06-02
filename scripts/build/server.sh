#!/bin/bash

set -eu

rm -rf ./dist

npm run tsc
cp "./tsconfig.json" "./dist"
cp -r "./server/static" "./server/assets" "./dist/server"
cp -r "./server/lib/emails" "./dist/server/lib"
