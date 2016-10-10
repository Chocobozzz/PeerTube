#!/bin/bash

read -p "This will remove all node and typescript modules. Are you sure? " -n 1 -r

if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  rm -rf node_modules client/node_modules
fi
