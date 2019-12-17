#!/bin/sh

set -eu

NODE_ENV=test npm run concurrently -- -k \
  "cd client && npm run ng -- serve --proxy-config proxy.config.json --hmr --configuration hmr --host 0.0.0.0 --disable-host-check --port 3000" \
  "npm run build:server && NODE_ENV=test npm start"
