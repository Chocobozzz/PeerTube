#!/bin/bash

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

rm -rf ./dist

npm run tsc -- -b --verbose
npm run resolve-tspaths:server

cp -r "./server/static" "./server/assets" "./dist/server"
cp -r "./server/lib/emails" "./dist/server/lib"
