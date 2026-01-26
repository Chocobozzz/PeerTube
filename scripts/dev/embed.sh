#!/bin/bash

set -eu

npm run build:server -- --incremental
(cd client/src/standalone/player && npm run build)

npm run concurrently -- -k \
  "cd client/src/standalone/player && npm run dev" \
  "cd client && ./node_modules/.bin/vite -c ./src/standalone/videos/vite.config.mjs dev" \
  "NODE_ENV=dev npm start"
