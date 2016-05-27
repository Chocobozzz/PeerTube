#!/usr/bin/env sh

cd client || exit -1
find app -regextype posix-egrep -regex ".*\.(js|map)$" -exec rm -f {} \;
rm -rf ./bundles
rm -f main.js main.js.map
