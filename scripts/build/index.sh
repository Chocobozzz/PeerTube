#!/bin/sh

set -eu

if [[ -n ${1+x} ]]; then
  clientCommand="npm run build:client -- $1"
else
  clientCommand="npm run build:client"
fi

npm run concurrently -- --raw \
  "$clientCommand" \
  "npm run build:server"
