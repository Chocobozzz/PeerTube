#!/usr/bin/env sh

cd client || exit -1

npm run webpack-dev-server -- --config config/webpack.dev.js --progress --profile --colors --watch --content-base src/ --inline --hot --open
