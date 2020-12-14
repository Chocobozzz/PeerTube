#!/bin/sh

set -eu

git fetch weblate && git merge weblate/develop

cd client
npm run ng -- extract-i18n --out-file src/locale/angular.xlf

# Merge new translations in other language files
npm run ng run -- PeerTube:xliffmerge

# Add our strings too
cd ../
npm run i18n:create-custom-files
