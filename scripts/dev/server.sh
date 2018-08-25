#!/bin/sh

set -eu

if [ ! -f "./client/dist/en_US/index.html" ]; then
  echo "client/dist/en_US/index.html does not exist, compile client files..."
  npm run build:client
fi

npm run watch:server
