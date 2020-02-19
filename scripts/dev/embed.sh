#!/bin/bash

set -eu

NODE_ENV=test npm run concurrently -- -k \
  "cd client && npm run webpack -- --config webpack/webpack.video-embed.js --mode development --watch" \
  "npm run build:server && NODE_ENV=test npm start"
