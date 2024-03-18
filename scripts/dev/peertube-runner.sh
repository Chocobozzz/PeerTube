#!/bin/bash

set -eu

rm -rf ./apps/peertube-runner/dist

cd ./apps/peertube-runner

../../node_modules/.bin/tsc -b --verbose

../../node_modules/.bin/concurrently -k \
  "../../node_modules/.bin/tsc -w --noEmit" \
  "node ./scripts/watch.js"
