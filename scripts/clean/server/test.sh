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
  host="127.0.0.1"

  redis-cli -h "$host" KEYS "bull-127.0.0.1:$port*" | grep -v empty | xargs -r redis-cli -h "$host" DEL
  redis-cli -h "$host" KEYS "redis-127.0.0.1:$port*" | grep -v empty | xargs -r redis-cli -h "$host" DEL
  redis-cli -h "$host" KEYS "*redis-127.0.0.1:$port-" | grep -v empty | xargs -r redis-cli -h "$host" DEL
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
