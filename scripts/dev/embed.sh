#!/bin/bash

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

npm run concurrently -- -k \
  "cd client && npm run webpack -- --config webpack/webpack.video-embed.js --mode development --watch" \
  "npm run build:server && NODE_ENV=dev npm start"
