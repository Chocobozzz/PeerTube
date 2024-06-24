#!/bin/bash

set -eu

cd client && ./node_modules/.bin/vite -c ./src/standalone/videos/vite.config.mjs build --mode=production
