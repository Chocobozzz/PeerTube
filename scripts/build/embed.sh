#!/bin/bash

set -eu

(cd client/src/standalone/player && npm run build)

cd client && ./node_modules/.bin/vite -c ./src/standalone/videos/vite.config.mjs build --mode=production
