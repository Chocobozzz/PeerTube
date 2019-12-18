#!/bin/sh

set -eu

NODE_ENV=test npm run concurrently -- -k \
  "npm run dev:client" \
  "npm run dev:server"
