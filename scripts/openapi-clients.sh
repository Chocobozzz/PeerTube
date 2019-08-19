#!/bin/bash
# Unofficial bash strict mode
# https://web.archive.org/web/20190115051613/https://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euvo pipefail
IFS=$'\n\t '

for lang in ${API_LANGS} ; do
(
    echo "Generating client API libs for $lang"

    out_dir="dist/api/$lang"
    repo_id="${API_REPO_PREFIX}${lang}"
    git_remote="https://${API_GIT_USER}:${GIT_TOKEN}@github.com/${API_GIT_USER}/${repo_id}.git"
    if ! [ -e "$out_dir" ] ; then
        git clone "https://github.com/${API_GIT_USER}/${repo_id}.git" "$out_dir"
    fi

    docker run --rm -v ${PWD}:/local openapitools/openapi-generator-cli generate \
        -i /local/support/doc/api/openapi.yaml \
        -c "/local/openapi/${lang}.yaml" \
        -g "$lang" \
        --git-user-id "${API_GIT_USER}" \
        --git-repo-id "${repo_id}" \
        -o "/local/$out_dir"

    # Docker uses root so we need to undo that
    sudo chown -R `id -u` "$out_dir"

    # Commit and push changes to the remote
    cd "$out_dir"
    git remote set-url origin "$git_remote"
    git add .
    git commit -m "${API_COMMIT_MSG:-"Minor update"}"
    git push
)
done
