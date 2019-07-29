#!/bin/sh

set -eu

recreateDB () {
  dbname="peertube_test$1"

  dropdb --if-exists "$dbname" 2>&1

  createdb -O peertube "$dbname"
  psql -c "CREATE EXTENSION pg_trgm;" "$dbname" &
  psql -c "CREATE EXTENSION unaccent;" "$dbname" &
}

removeFiles () {
  rm -rf "./test$1" "./config/local-test.json" "./config/local-test-$1.json" ~/.config/PeerTube/CLI-$1
}

dropRedis () {
  port=$((9000+$1))
  host="localhost"

  if [ ! -z ${GITLAB_CI+x} ]; then
    host="redis"
  fi

  redis-cli -h "$host" KEYS "bull-localhost:$port*" | grep -v empty | xargs --no-run-if-empty redis-cli -h "$host" DEL
  redis-cli -h "$host" KEYS "redis-localhost:$port*" | grep -v empty | xargs --no-run-if-empty redis-cli -h "$host" DEL
  redis-cli -h "$host" KEYS "*redis-localhost:$port-" | grep -v empty | xargs --no-run-if-empty redis-cli -h "$host" DEL
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
