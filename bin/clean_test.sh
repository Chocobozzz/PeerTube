#!/bin/bash

basePath=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

for i in $(seq 1 6); do
  printf "use peertube-test%s;\ndb.dropDatabase();" "$i" | mongo
  rm -rf "$basePath/../server/test$i"
done
