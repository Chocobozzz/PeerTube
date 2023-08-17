#!/bin/bash

set -eu

cd ./apps/peertube-cli
rm -rf ./dist

../../node_modules/.bin/tsc -b --verbose
rm -rf ./dist
mkdir ./dist

node ./scripts/build.js
