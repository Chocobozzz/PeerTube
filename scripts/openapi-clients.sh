#!/bin/bash
# Unofficial bash strict mode
# https://web.archive.org/web/20190115051613/https://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'


docker run --rm -v ${PWD}:/local openapitools/openapi-generator-cli generate \
    -i /local/support/doc/api/openapi.yaml \
    -g python \
    -o /local/dist/api/python

# Will use #$GIT_USER $GIT_REPO_ID and $GIT_TOKEN to update repo upon build
dist/api/python/git_push.sh
