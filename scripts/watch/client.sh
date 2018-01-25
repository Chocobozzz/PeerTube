#!/usr/bin/env sh

cd client || exit -1

npm run ng -- server --hmr --host 0.0.0.0 --disable-host-check --port 3000
