#!/bin/bash

set -eu

npm run build:server

npm run concurrently -- -k \
  "cd client && ./node_modules/.bin/vite -c ./src/standalone/videos/vite.config.mjs build -w --mode=development" \
  "NODE_ENV=dev npm start"
