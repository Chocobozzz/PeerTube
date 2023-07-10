#!/bin/sh

set -eu

cd client/src/standalone/embed-player-api

rm -rf dist build && tsc -p . && ../../../node_modules/.bin/webpack --config ./webpack.config.js

npm publish --access public

rm -rf dist build node_modules
