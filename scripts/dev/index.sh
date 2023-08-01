#!/bin/bash

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

npm run concurrently -- -k \
  "sh scripts/dev/client.sh --skip-server ${1:-}" \
  "sh scripts/dev/server.sh --skip-client"
