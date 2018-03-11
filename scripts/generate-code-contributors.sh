#!/usr/bin/env bash

curl -s https://api.github.com/repos/chocobozzz/peertube/contributors | \
  jq -r 'map("\\\n * [" + .login + "](" + .url + ")") | .[]' | \
  xargs echo | sed 's/api.github.com\/users/github.com/g'
