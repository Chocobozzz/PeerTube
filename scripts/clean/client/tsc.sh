#!/usr/bin/env sh

cd client || exit -1
find angular -regextype posix-egrep -regex ".*\.(js|map)$" -exec rm -f {} \;
