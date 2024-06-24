#!/bin/sh

set -eu

cd client/src/standalone/embed-player-api

npm run build
npm publish --access public

rm -rf dist build node_modules
