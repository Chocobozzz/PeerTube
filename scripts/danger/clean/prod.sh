#!/bin/bash

read -p "This will remove all directories and SQL tables. Are you sure? (y/*) " -n 1 -r
echo

if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  NODE_ENV=production node "./scripts/danger/clean/cleaner"
fi
