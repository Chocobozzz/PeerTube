#!/usr/bin/env sh

NODE_ENV=test concurrently \
  "npm run watch:client" \
  "npm start"
