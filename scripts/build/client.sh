#!/bin/bash

cd client || exit -1

rm -rf ./dist

ng build -- --prod
NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js
