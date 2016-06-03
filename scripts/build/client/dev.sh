#!/usr/bin/env sh

cd client || exit -1

npm run webpack -- --config config/webpack.dev.js --progress --profile --colors --display-error-details --display-cached
