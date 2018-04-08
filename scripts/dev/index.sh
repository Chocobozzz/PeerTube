#!/bin/sh

set -eu

NODE_ENV=test concurrently -k \
  "npm run watch:client" \
  "npm run watch:server"
