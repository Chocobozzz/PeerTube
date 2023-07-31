#!/bin/bash

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

rm -rf ./packages/peertube-runner/dist

cd ./packages/peertube-runner

../../node_modules/.bin/concurrently -k \
  "../../node_modules/.bin/tsc -w --noEmit" \
  "./node_modules/.bin/esbuild ./peertube-runner.ts --bundle --sourcemap --platform=node --external:"./lib-cov/fluent-ffmpeg" --external:pg-hstore --watch --outfile=dist/peertube-runner.js"
