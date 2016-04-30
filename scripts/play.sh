#!/usr/bin/env sh

if [ ! -f server.js ]; then
  echo "Missing server file (server.js)."
  exit -1
fi

for i in 1 2 3; do
  NODE_ENV=test NODE_APP_INSTANCE=$i node server.js &
  sleep 1
done
