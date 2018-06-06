#!/bin/sh

set -eu

cd client
npm run ng -- xi18n --i18n-locale "en-US" --output-path locale/source --out-file messages_en_US.xml
npm run ngx-extractor -- --locale "en-US" -i 'src/**/*.ts' -f xlf -o src/locale/source/messages_en_US.xml

# Zanata does not support inner elements in <source>, so we hack these special elements
# This regex translate the Angular elements to special entities (that we will reconvert on pull)
#sed -i 's/<x id=\(.\+\?\)\/>/\&lt;x id=\1\/\&gt;/g' src/locale/source/messages_en_US.xml
perl -pi -e 's|<x id=(.+?)/>|&lt;x id=\1/&gt;|g' src/locale/source/messages_en_US.xml

# Add our strings too
cd ../
npm run i18n:create-custom-files