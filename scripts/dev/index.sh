#!/bin/sh

set -eu

NODE_ENV=test npm run concurrently -- -k \
  "npm run dev:client -- --skip-server" \
  "npm run dev:server"
