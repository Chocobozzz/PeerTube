#!/usr/bin/env sh

cd client || exit -1
node systemjs.bundle.js
npm run tsc
