#!/bin/bash

set -eu

npm run build:server -- --incremental

npm run concurrently -- -k \
  "cd client && ./node_modules/.bin/vite -c ./src/standalone/videos/vite.config.mjs dev" \
  "NODE_ENV=dev npm start"
