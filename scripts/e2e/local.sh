#!/bin/sh

set -eu

npm run clean:server:test

config="{"
config+="  \"rates_limit\": { \"api\": { \"max\": 5000 }, \"login\": { \"max\": 5000 } }"
config+=", \"log\": { \"level\": \"warn\" }"
config+=", \"signup\": { \"enabled\": false }"
config+=", \"transcoding\": { \"enabled\": false }"
config+="}"

npm run concurrently -- -k -s first \
    "cd client/e2e && ../node_modules/.bin/wdio run ./wdio.local.conf.ts" \
    "NODE_ENV=test NODE_CONFIG='$config' NODE_APP_INSTANCE=1  node dist/server" \
    "NODE_ENV=test NODE_CONFIG='$config' NODE_APP_INSTANCE=2  node dist/server"
