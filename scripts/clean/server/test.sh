#!/usr/bin/env sh

for i in $(seq 1 6); do
  printf "use peertube-test%s;\ndb.dropDatabase();" "$i" | mongo
  rm -rf "./test$i"
done
