#!/bin/sh

set -eu

# Zanata does not support inner elements in <source>, so we hack these special elements
# This regex translate the converted elements to initial Angular elements

for i in 1 2 3; do
    perl -pi -e 's|&lt;x id=(.+?)/&gt;([^"])|<x id=\1/>\2|g' client/src/locale/target/*.xml
done

npm run i18n:xliff2json

