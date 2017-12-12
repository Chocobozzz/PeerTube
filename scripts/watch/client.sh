#!/usr/bin/env sh

cd client || exit -1

ng server --hmr --host localhost --port 3000
