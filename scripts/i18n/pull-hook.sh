#!/bin/sh

set -eu

# Zanata does not support inner elements in <source>, so we hack these special elements
# This regex translate the converted elements to initial Angular elements
sed -i 's/\&lt;x id=\([^\/]\+\?\)\/\&gt;/<x id=\1\/>/g' client/src/locale/target/*