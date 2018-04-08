#!/bin/sh

set -eu

if [ ! -f "dist/server.js" ]; then
  echo "Missing server file (server.js)."
  exit -1
fi

max=${1:-3}

for i in $(seq 1 "$max"); do
  NODE_ENV=test NODE_APP_INSTANCE=$i node dist/server.js &
  sleep 1
done
