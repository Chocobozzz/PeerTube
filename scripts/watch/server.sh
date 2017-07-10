#!/usr/bin/env sh

NODE_ENV=test concurrently -k \
  "npm run tsc -- --sourceMap && npm run nodemon -- --delay 2 --watch ./dist dist/server" \
  "npm run tsc -- --sourceMap -w"
