#!/bin/bash

printf "use petube-test1;\ndb.dropDatabase();\nuse petube-test2;\ndb.dropDatabase();\nuse petube-test3;\ndb.dropDatabase();" | mongo

rm -rf ./test1 ./test2 ./test3
