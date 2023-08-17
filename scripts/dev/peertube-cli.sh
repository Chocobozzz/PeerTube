#!/bin/bash

set -eu

rm -rf ./apps/peertube-cli/dist

cd ./apps/peertube-cli

../../node_modules/.bin/concurrently -k \
  "../../node_modules/.bin/tsc -w --noEmit" \
  "node ./scripts/watch.js"
