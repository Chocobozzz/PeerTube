#!/bin/sh

set -eu

for i in 1 2 3; do
    # Angular does not like when there is not target element, so we create it with the same content than the source element
    perl -0pi -e 's#<source>([^<]+)</source>\s*<context-group #<source>\1</source><target>\1</target><context-group #g' client/src/locale/target/angular_*.xml

    # Zanata does not support inner elements in <source>, so we hack these special elements
    # This regex translate the converted elements to initial Angular elements
    perl -pi -e 's|&lt;x id=(.+?)/&gt;([^"])|<x id=\1/>\2|g' client/src/locale/target/*.xml
done

npm run i18n:xliff2json

