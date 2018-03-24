#!/bin/sh

set -eu

cd client

npm run webpack-bundle-analyzer ./dist/stats.json
