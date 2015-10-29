#!/bin/bash

printf "use peertube-test1;\ndb.dropDatabase();\nuse peertube-test2;\ndb.dropDatabase();\nuse peertube-test3;\ndb.dropDatabase();" | mongo

rm -rf ./test1 ./test2 ./test3
