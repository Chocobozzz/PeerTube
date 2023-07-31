#!/bin/sh

# SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

cd client/e2e && ../node_modules/.bin/wdio run ./wdio.browserstack.conf.ts
