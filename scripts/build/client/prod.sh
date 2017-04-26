#!/usr/bin/env sh

cd client || exit -1

rm -rf ./compiled

npm run webpack -- --config config/webpack.prod.js  --progress --profile --bail
