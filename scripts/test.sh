#!/usr/bin/env sh

cd client || exit -1
npm test || exit -1

cd .. || exit -1
standard || exit -1
mocha server/tests
