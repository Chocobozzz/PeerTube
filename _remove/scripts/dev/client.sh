#!/bin/bash

set -eu

clientConfiguration="hmr"

if [ ! -z ${2+x} ] && [ "$2" = "--ar-locale" ]; then
  clientConfiguration="ar-locale"
fi

clientCommand="cd client && node --max_old_space_size=4096 node_modules/.bin/ng serve --proxy-config proxy.config.json --hmr --configuration $clientConfiguration --host 0.0.0.0 --disable-host-check --port 3000"
serverCommand="npm run build:server && NODE_ENV=dev node dist/server"

if [ ! -z ${1+x} ] && [ "$1" = "--skip-server" ]; then
  eval $clientCommand
else
  node node_modules/.bin/concurrently -k \
    "$clientCommand" \
    "$serverCommand"
fi


