#!/bin/bash

set -eu

npm run build:server

npm run concurrently -- -k \
  "cd client && npm run webpack -- --config webpack/webpack.video-embed.js --mode development --watch" \
  "NODE_ENV=dev npm start"
