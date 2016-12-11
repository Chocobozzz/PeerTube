#!/usr/bin/env sh

for i in $(seq 1 6); do
  dropdb "peertube_test$i"
  rm -rf "./test$i"
  createdb "peertube_test$i"
done
