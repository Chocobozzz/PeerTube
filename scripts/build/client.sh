#!/bin/sh

set -eu

cd client

rm -rf ./dist ./compiled

npm run ng build -- --prod --stats-json
NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js
