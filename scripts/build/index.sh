#!/bin/bash

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

if [ ! -z ${1+x} ]; then
  clientCommand="npm run build:client -- $1"
else
  clientCommand="npm run build:client"
fi

npm run concurrently -- --raw \
  "$clientCommand" \
  "npm run build:server"
