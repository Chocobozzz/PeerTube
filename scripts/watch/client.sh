#!/usr/bin/env sh

cd client || exit -1

npm run ng -- server --hmr --host localhost --port 3000
