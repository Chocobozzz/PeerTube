#!/bin/bash

set -eu

npm run concurrently -- -k \
  "sh scripts/dev/client.sh --skip-server ${1:-}" \
  "sh scripts/dev/server.sh --skip-client"
