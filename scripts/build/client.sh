#!/bin/bash

cd client || exit -1

rm -rf ./compiled ./dist

npm run webpack -- --config config/webpack.prod.js  --progress --profile --bail
