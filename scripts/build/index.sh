#!/bin/sh

set -eu

npm run concurrently -- -k \
  "npm run build:client" \
  "npm run build:server"
