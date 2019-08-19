#!/bin/bash
# Unofficial bash strict mode
# https://web.archive.org/web/20190115051613/https://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

OUT_DIR=dist/api/python

if ! [ -e $OUT_DIR ] ; then
    git clone "https://github.com/${GIT_USER_ID}/${GIT_REPO_ID}.git" "$OUT_DIR"
fi

docker run --rm -v ${PWD}:/local openapitools/openapi-generator-cli generate \
    -i /local/support/doc/api/openapi.yaml \
    -c /local/openapi/python.yaml \
    -g python \
    --git-user-id "${GIT_USER_ID}" \
    --git-repo-id "${GIT_REPO_ID}" \
    -o /local/$OUT_DIR

# Docker uses root so we need to undo that
sudo chown -R `id -u` "$OUT_DIR"

# Will use #$GIT_USER $GIT_REPO_ID and $GIT_TOKEN to update repo upon build
cd "$OUT_DIR"
git remote set-url origin https://${GIT_USER_ID}:${GIT_TOKEN}@github.com/${GIT_USER_ID}/${GIT_REPO_ID}.git
bash git_push.sh "${GIT_USER_ID}" "${GIT_REPO_ID}"
