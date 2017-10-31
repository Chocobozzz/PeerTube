#!/bin/bash

npm run build:server || exit -1
npm run travis -- lint || exit -1

mocha --exit --require ts-node/register --bail server/tests/index.ts
