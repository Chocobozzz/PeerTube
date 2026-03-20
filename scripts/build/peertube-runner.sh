#!/bin/bash

set -eu

cd ./apps/peertube-runner
rm -rf ./dist

../../node_modules/.bin/tsc -b --verbose
rm -rf ./dist
mkdir ./dist

npm run build
