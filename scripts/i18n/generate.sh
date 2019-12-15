#!/bin/sh

set -eu

cd client
npm run ng -- xi18n --i18n-locale "en-US" --output-path src/locale --out-file angular.xlf
npm run ngx-extractor -- --locale "en-US" -i 'src/**/*.ts' -f xlf -o src/locale/angular.xlf

# Merge new translations in other language files
npm run ng run -- PeerTube:xliffmerge

# Add our strings too
cd ../
npm run i18n:create-custom-files
