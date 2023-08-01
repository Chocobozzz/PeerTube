#!/bin/sh

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

NOCLIENT=1 yarn install --pure-lockfile

rm -rf ./dist/server/tools/

(
    cd ./server/tools
    yarn install --pure-lockfile
    ../../node_modules/.bin/tsc --build --verbose
)

cp -r "./server/tools/node_modules" "./dist/server/tools"

npm run resolve-tspaths:server
