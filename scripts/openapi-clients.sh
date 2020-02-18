#!/bin/bash
# Required environment vars
# =========================
# API_LANGS
#   A ':' delimited list of the client lib languages to be generated
# API_GIT_USER
#   The user that will be used to push/pull from the APIs repos
# API_GIT_EMAIL
#   The git email
# GIT_TOKEN
#   A personal access token for github or gilab for pushing to repos
#   !!!This is a secret and shouldn't be logged publicly!!!

# (Optional environment vars)
# ===========================
# API_COMMIT_MSG
#   A message to use when committing to the lib repo
# API_PATH_PREFIX
#   Will be used for building the URL to the repo and path to checkout.
#   !!! End with a slash "/", otherwise the prefix will be tacked onto the language
# API_URL_USERNAME
#   The username to use building the URL to the git repo.
#   Default: API_GIT_USER
# API_REPO_HOST
#   Whoever's hosting the repo e.g gitlab.com, github.com, etc.
#   Default: framagit.org

# Unofficial bash strict mode
# https://web.archive.org/web/20190115051613/https://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t '

# Set default values
API_URL_USERNAME="${API_URL_USERNAME:-$API_GIT_USER}"
API_PATH_PREFIX="${API_PATH_PREFIX:-}"
API_REPO_HOST=${API_REPO_HOST:-framagit.org}

echo "API_GIT_USER='${API_GIT_USER}'"
echo "API_URL_USERNAME='${API_URL_USERNAME}'"
echo "API_LANGS='${API_LANGS}'"

git config --global user.email "${API_GIT_EMAIL}"
git config --global user.name "${API_GIT_USER}"

for lang in ${API_LANGS//:/ } ; do
(
    echo "Generating client API libs for $lang"

    lang_dir="support/openapi/${lang}"

    out_dir_prefix="dist/api/${API_PATH_PREFIX}"
    out_dir="${out_dir_prefix}/${lang}"
    git_repo_id="${API_PATH_PREFIX}${lang}"
    host_path="${API_REPO_HOST}/${API_URL_USERNAME}/${git_repo_id}.git"
    git_remote="https://${API_GIT_USER}:${GIT_TOKEN}@${host_path}"
    if ! [ -e "$out_dir" ] ; then
        # Make sure the prefix exists before cloning the repo
        mkdir -p "${out_dir_prefix}"
        git clone "https://${host_path}" "$out_dir"
    fi

    npx openapi-generator generate \
        -i support/doc/api/openapi.yaml \
        -c "${lang_dir}/def.yaml" \
        -t "${lang_dir}" \
        -g "$lang" \
        --git-host "${API_REPO_HOST}" \
        --git-user-id "${API_URL_USERNAME}" \
        --git-repo-id "${git_repo_id}" \
        -o "${out_dir}"

    # Commit and push changes to the remote
    cd "$out_dir"
    git remote set-url origin "$git_remote"
    # Make sure something has changed
  if [[ $(git status -s | wc -l) = 0 ]] ; then
        echo "No changes from previous version"
        continue
    fi
    git add .
    git commit -m "${API_COMMIT_MSG:-"Minor update $lang"}"
    git push
)
done
