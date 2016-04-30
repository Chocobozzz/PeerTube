#!/usr/bin/env sh

cd client || exit -1

concurrently \
  "node-sass -w --include-path node_modules/bootstrap-sass/assets/stylesheets/ stylesheets/application.scss stylesheets/index.css client/angular/**/ client/angular/**/**" \
  "node-sass -w angular/ --output angular/"
