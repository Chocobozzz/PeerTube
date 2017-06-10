#!/usr/bin/env sh

NODE_ENV=test concurrently \
  "npm run build:client:prod" \
  "npm run build:server:prod"
