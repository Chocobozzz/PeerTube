#!/usr/bin/env sh

npm run clean:client:sass
cd client || exit -1

# Compile index and angular files
concurrently \
  "node-sass --include-path node_modules/bootstrap-sass/assets/stylesheets/ stylesheets/application.scss stylesheets/index.css" \
  "node-sass angular/ --output angular/"
