#!/bin/sh

set -eu

node_modules/marked-man/bin/marked-man server/tools/README.md > dist/server/tools/peertube.8
