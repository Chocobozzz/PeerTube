#!/bin/sh

set -eu

for i in $(seq 1 10); do
    # Zanata does not support inner elements in <source>, so we hack these special elements
    # This regex translate the converted elements to initial Angular elements
    perl -pi -e 's|&lt;x id=(.+?)/&gt;([^"])|<x id=\1/>\2|g' client/src/locale/target/*.xml
done

npm run i18n:xliff2json

