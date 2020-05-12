#!/bin/sh

set -eu

npm run clean:server:test

(
    cd client
    npm run webpack -- --config webpack/webpack.video-embed.js --mode development
)

npm run concurrently -- -k -s first \
    "cd client && npm run ng -- e2e --port 3333 -c local" \
    "NODE_ENV=test NODE_APP_INSTANCE=1 NODE_CONFIG='{ \"log\": { \"level\": \"warning\" }, \"signup\": { \"enabled\": false } }' node dist/server"
