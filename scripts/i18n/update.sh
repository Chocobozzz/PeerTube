#!/bin/sh

set -eu

git fetch weblate && git merge weblate/develop

npm run build:embed

cd client
npm run ng -- extract-i18n --out-file src/locale/angular.xlf

locales=$(find src/locale -type f | grep -e 'angular\.[^.]\+\.xlf' | sed 's#^src/locale/angular.##' | sed 's/\.xlf$//' | sort -u | tr '\n' ' ')

# Merge new translations in other language files
node ./node_modules/.bin/xliffmerge -p ./.xliffmerge.json $locales

(
  cd src/locale

  for file in angular.*.xlf; do
    xmllint --format $file > "$file.tmp" && mv "$file.tmp" "$file"
  done
)

# Add our strings too
cd ../
npm run i18n:create-custom-files
