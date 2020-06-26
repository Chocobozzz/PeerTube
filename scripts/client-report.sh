#!/bin/sh

set -eu

gawk -i inplace 'BEGIN { found=0 } { if (found || $0 ~ /^{/) { found=1; print }}' ./client/dist/standalone/videos/embed-stats.json

npm run concurrently -- -k \
    "cd client && npm run webpack-bundle-analyzer -- -p 8888 ./dist/en-US/stats.json" \
    "cd client && npm run webpack-bundle-analyzer -- -p 8889 ./dist/standalone/videos/embed-stats.json"
