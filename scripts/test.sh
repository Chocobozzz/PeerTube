#!/bin/sh

set -eu

npm run build:server
npm run travis -- lint

mocha --exit --require ts-node/register/type-check --bail server/tests/index.ts
