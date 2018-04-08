#!/bin/sh

set -eu

if [ ! -f "./client/dist/index.html" ]; then
  echo "client/dist/index.html does not exist, compile client files..."
  npm run build:client
fi

npm run watch:server
