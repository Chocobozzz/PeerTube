#!/bin/bash

set -eu

(cd client/src/standalone/player && npm run build)

clientConfiguration="hmr"

if [ ! -z ${2+x} ] && [ "$2" = "--ar-locale" ]; then
  clientConfiguration="ar-locale"
fi

embedCommand="cd client/src/standalone/player && npm run dev"
clientCommand="cd client && node --max_old_space_size=4096 node_modules/.bin/ng serve --proxy-config proxy.config.json --hmr --configuration $clientConfiguration --host 0.0.0.0 --port 3000"
serverCommand="NODE_ENV=dev node dist/server"

if [ ! -z ${1+x} ] && [ "$1" = "--skip-server" ]; then
  node node_modules/.bin/concurrently -k \
    "$embedCommand" \
    "$clientCommand"
else
  npm run build:server

  node node_modules/.bin/concurrently -k \
    "$embedCommand" \
    "$clientCommand" \
    "$serverCommand"
fi
