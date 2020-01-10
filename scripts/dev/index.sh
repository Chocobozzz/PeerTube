#!/bin/sh

set -eu

NODE_ENV=test npm run concurrently -- -k \
  "sh scripts/dev/client.sh --skip-server" \
  "sh scripts/dev/server.sh"
