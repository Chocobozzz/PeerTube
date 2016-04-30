#!/usr/bin/env sh

cd client || exit -1
rm -f stylesheets/index.css
find angular -regextype posix-egrep -regex ".*\.(css)$" -exec rm -f {} \;
