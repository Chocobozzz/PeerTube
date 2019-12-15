#!/bin/sh

set -eu

npm run build:server
npm run setup:cli

npm run ci -- lint

mocha --exit --require ts-node/register/type-check --require tsconfig-paths/register --bail server/tests/index.ts
