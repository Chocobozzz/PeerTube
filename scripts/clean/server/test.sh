#!/bin/sh

set -eu

for i in $(seq 1 6); do
  dbname="peertube_test$i"

  dropdb --if-exists "$dbname"
  rm -rf "./test$i"
  rm -f "./config/local-test.json"
  rm -f "./config/local-test-$i.json"
  createdb -O peertube "$dbname"
  psql -c "CREATE EXTENSION pg_trgm;" "$dbname"
  psql -c "CREATE EXTENSION unaccent;" "$dbname"
  redis-cli KEYS "bull-localhost:900$i*" | grep -v empty | xargs --no-run-if-empty redis-cli DEL
done
