#!/bin/sh

set -eu

npm run spectacle-docs -- -t support/doc/api/html support/doc/api/openapi.yaml
