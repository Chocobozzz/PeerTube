#!/bin/sh

set -eu

git fetch weblate && git merge weblate/develop

npm run build -- --i18n

cd client
./node_modules/.bin/localize-extract -r . -f xliff --locale "en-US" -s 'dist/en-US/*.js' -o src/locale/angular.xlf

# Workaround of https://github.com/angular/angular/issues/38437
sed -i 's/other {{INTERPOLATION}/other {<x id="INTERPOLATION"\/>/g' src/locale/angular.xlf

# Merge new translations in other language files
npm run ng run -- PeerTube:xliffmerge

# Add our strings too
cd ../
npm run i18n:create-custom-files
