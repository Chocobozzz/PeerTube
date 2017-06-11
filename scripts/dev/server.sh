#!/usr/bin/env sh

if [ ! -d "./client/dist" ]; then
  echo "client/dist does not exist, compile client files..."
  npm run build:client
fi

npm run watch:server
