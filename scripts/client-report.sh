#!/bin/sh

set -eu

npm run concurrently -- -k \
    "cd client/src/standalone/player/ && npx vite-bundle-visualizer" \
    "cd client/src/standalone/videos/ && npx vite-bundle-visualizer" \
    "cd client && npx esbuild-visualizer --metadata ./dist/en-US/stats.json --open"
