#!/bin/sh

set -eu

clientCommand="cd client && npm run ng -- serve --proxy-config proxy.config.json --hmr --configuration hmr --host 0.0.0.0 --disable-host-check --port 3000"
serverCommand="npm run build:server && NODE_ENV=test npm start"

if [ ! -z ${1+x} ] && [ "$1" == "--skip-server" ]; then
  NODE_ENV=test eval $clientCommand
else
  NODE_ENV=test npm run concurrently -- -k \
    "$clientCommand" \
    "$serverCommand"
fi


