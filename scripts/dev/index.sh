#!/bin/sh

set -eu

NODE_ENV=test npm run concurrently -- -k \
  "npm run watch:client" \
  "npm run watch:server"
