#!/bin/bash
# Unofficial bash strict mode
# https://web.archive.org/web/20190115051613/https://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

OUT_DIR=dist/api/python

docker run --rm -v ${PWD}:/local openapitools/openapi-generator-cli generate \
    -i /local/support/doc/api/openapi.yaml \
    -c /local/openapi/python.yaml \
    -g python \
    --git-user-id "${GIT_USER_ID}" \
    --git-repo-id "${GIT_REPO_ID}" \
    -o /local/$OUT_DIR

# Docker uses root so we need to undo that
sudo chown -R `id -u` $OUT_DIR

# Will use #$GIT_USER $GIT_REPO_ID and $GIT_TOKEN to update repo upon build
bash $OUT_DIR/git_push.sh "${GIT_USER_ID}" "${GIT_REPO_ID}"
