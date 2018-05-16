#!/bin/sh

set -eu

#npm run build:server
npm run clean:server:test

concurrently -k -s first \
    "cd client && npm run ng -- e2e" \
    "NODE_ENV=test NODE_APP_INSTANCE=1 npm start"

