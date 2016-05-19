#!/bin/bash

read -p "This will remove certs, uploads, database (dev) and logs. Are you sure? " -n 1 -r

if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  rm -rf ./certs ./logs ./uploads
  printf "use peertube-dev;\ndb.dropDatabase();" | mongo
fi
