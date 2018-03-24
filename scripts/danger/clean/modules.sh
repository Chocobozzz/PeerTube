#!/bin/bash

set -eu

read -p "This will remove all node server and client modules. Are you sure? " -n 1 -r

if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  rm -rf node_modules client/node_modules
fi
