#!/bin/bash

set -eu


cd ./packages/peertube-runner
rm -rf ./dist

../../node_modules/.bin/tsc -b --verbose
rm -rf ./dist
mkdir ./dist

./node_modules/.bin/esbuild ./peertube-runner.ts --bundle --platform=node --target=node16 --external:"./lib-cov/fluent-ffmpeg" --external:pg-hstore --outfile=dist/peertube-runner.js
