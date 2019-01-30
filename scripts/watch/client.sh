#!/bin/sh

set -eu

cd client

npm run ng -- serve --proxy-config proxy.config.json --hmr --configuration hmr --host 0.0.0.0 --disable-host-check --port 3000
