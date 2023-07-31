#!/bin/bash

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

rm -rf ./dist/server/tools/

(
    cd ./server/tools
    yarn install --pure-lockfile
)

mkdir -p "./dist/server/tools"
cp -r "./server/tools/node_modules" "./dist/server/tools"

cd ./server/tools
../../node_modules/.bin/tsc-watch --build --verbose --onSuccess 'sh -c "cd ../../ && npm run resolve-tspaths:server"'
