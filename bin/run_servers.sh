#!/bin/bash

if [ ! -f server.js ]; then
  echo "The script has to be executed at the root of the project."
  exit -1
fi

NODE_ENV=test NODE_APP_INSTANCE=1 node server.js &
sleep 1
NODE_ENV=test NODE_APP_INSTANCE=2 node server.js &
sleep 1
NODE_ENV=test NODE_APP_INSTANCE=3 node server.js &
