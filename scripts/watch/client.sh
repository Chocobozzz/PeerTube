#!/bin/sh

set -eu

cd client

npm run ng -- serve --hmr --host 0.0.0.0 --disable-host-check --port 3000
