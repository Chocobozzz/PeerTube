#!/bin/bash

set -eu

rm -rf ./packages/tests/dist

npm run tsc --  -b --verbose ./packages/tests/tsconfig.json
npm run resolve-tspaths:server-lib
npm run resolve-tspaths:tests
