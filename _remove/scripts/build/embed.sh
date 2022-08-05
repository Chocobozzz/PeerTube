#!/bin/bash

set -eu

cd client

mkdir -p ./dist/standalone/videos/

if [ ! -z ${ANALYZE_BUNDLE+x} ] && [ "$ANALYZE_BUNDLE" == true ]; then
  NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js --mode production --json > "./dist/standalone/videos/embed-stats.json"
else
  NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js --mode production
fi
