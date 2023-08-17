#!/bin/bash

set -eu

npm run build:server

# Angular does not support project references, it's the reason why we can't builds concurrently
if [ ! -z ${1+x} ]; then
  npm run build:client -- $1
else
  npm run build:client
fi
