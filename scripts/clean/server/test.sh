#!/bin/sh

set -eu

recreateDB () {
  dbname="peertube_test$1"

  dropdb --if-exists "$dbname"

  createdb -O peertube "$dbname"
  psql -c "CREATE EXTENSION pg_trgm;" "$dbname" &
  psql -c "CREATE EXTENSION unaccent;" "$dbname" &
}

removeFiles () {
  rm -rf "./test$1" "./config/local-test.json" "./config/local-test-$1.json"
}

dropRedis () {
  redis-cli KEYS "bull-localhost:900$1*" | grep -v empty | xargs --no-run-if-empty redis-cli DEL
  redis-cli KEYS "redis-localhost:900$1*" | grep -v empty | xargs --no-run-if-empty redis-cli DEL
}

seq=$(seq 1 6)

if [ ! -z ${1+x} ]; then
  seq=$1
fi


for i in $seq; do
  recreateDB "$i" &
  dropRedis "$i" &
  removeFiles "$i" &
done

wait
