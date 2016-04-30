#!/usr/bin/env sh

cd client || exit -1
npm test

cd .. || exit -1
standard
mocha server/tests
