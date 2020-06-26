#!/bin/bash

set -eu

cd client

mkdir -p ./dist/standalone/videos/

NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js --mode production --json > "./dist/standalone/videos/embed-stats.json"
