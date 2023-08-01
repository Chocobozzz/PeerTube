#!/bin/bash

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu


cd ./packages/peertube-runner
rm -rf ./dist

../../node_modules/.bin/tsc -b --verbose
rm -rf ./dist
mkdir ./dist

./node_modules/.bin/esbuild ./peertube-runner.ts --bundle --platform=node --target=node16 --external:"./lib-cov/fluent-ffmpeg" --external:pg-hstore --outfile=dist/peertube-runner.js
