#!/bin/sh

set -eu

gawk -i inplace 'BEGIN { found=0 } { if (found || $0 ~ /^{/) { found=1; print }}' ./client/dist/embed-stats.json

npm run concurrently -- -k \
    "cd client && npm run webpack-bundle-analyzer -- -p 8888 ./dist/en-US/stats-es2015.json" \
    "cd client && npm run webpack-bundle-analyzer -- -p 8889 ./dist/embed-stats.json"
