#!/usr/bin/env sh

cd client || exit -1

ng server --host localhost --port 3000
