#!/bin/bash

read -p "This will remove all directories and Mongo database. Are you sure? " -n 1 -r

if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  NODE_ENV=test node "./scripts/danger/clean/cleaner"
fi
