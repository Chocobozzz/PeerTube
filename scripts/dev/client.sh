#!/bin/bash

set -eu

(cd client/src/standalone/player && npm run build)

clientConfiguration="hmr"

if [ ! -z ${2+x} ] && [ "$2" = "--ar-locale" ]; then
  clientConfiguration="ar-locale"
fi

playerCommand="cd client/src/standalone/player && npm run dev"
embedCommand="cd client && ./node_modules/.bin/vite -c ./src/standalone/videos/vite.config.mjs dev"
clientCommand="cd client && NODE_OPTIONS=--max_old_space_size=8192 node_modules/.bin/ng serve --proxy-config proxy.config.json --hmr --configuration $clientConfiguration --host 0.0.0.0 --port 3000"
serverCommand="ANGULAR_CLIENT_ENABLED=true NODE_ENV=dev node dist/server"

if [ ! -z ${1+x} ] && [ "$1" = "--skip-server" ]; then
  node_modules/.bin/concurrently -k \
    "$playerCommand" \
    "$clientCommand" \
    "$embedCommand"
else
  npm run build:server

  node_modules/.bin/concurrently -k \
    "$playerCommand" \
    "$clientCommand" \
    "$embedCommand" \
    "$serverCommand"
fi
