#!/bin/sh

set -eu

cd client/e2e

../node_modules/.bin/wdio run ./wdio.local.conf.ts
