#!/bin/bash

set -eu

rm -rf ./packages/tests/dist

npm run tsc --  -b --verbose ./packages/tests/tsconfig.json
npm run tsc-alias:server-lib
npm run tsc-alias:tests
