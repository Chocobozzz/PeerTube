#!/bin/sh

set -eu

npm run clean:server:test

(
    cd client
    npm run webdriver-manager update
)

concurrently -k -s first \
    "cd client && npm run ng -- e2e" \
    "NODE_ENV=test NODE_APP_INSTANCE=1 NODE_CONFIG='{ \"log\": { \"level\": \"warning\" } }' npm start"

