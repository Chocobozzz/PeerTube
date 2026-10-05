#!/bin/bash

set -eu

# Assets the TypeScript build ignores, copied next to the modules that read them at runtime

mkdir -p ./dist/core

cp -r "./server/core/static" "./server/core/assets" ./dist/core
cp -r "./server/locales" ./dist

mkdir -p ./dist/core/lib/redis
cp -r "./server/core/lib/redis/lua" ./dist/core/lib/redis/
