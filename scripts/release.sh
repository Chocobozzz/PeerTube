#!/bin/bash

set -eu

shutdown() {
  # Get our process group id
  # shellcheck disable=SC2009
  PGID=$(ps -o pgid= $$ | grep -o "[0-9]*")

  # Kill it in a new new process group
  setsid kill -- -"$PGID"
  exit 0
}

trap "shutdown" SIGINT SIGTERM

if [ -z "$1" ]; then
  echo "Need version as argument"
  exit -1
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Need GITHUB_TOKEN env set."
  exit -1
fi

maintainer_public_key=${MAINTAINER_GPG:-"583A612D890159BE"}

peertube_directory=$(basename $(pwd))

branch=$(git symbolic-ref --short -q HEAD)
if [ "$branch" != "develop" ] && [[ "$branch" != release/* ]]; then
  echo "Need to be on develop or release branch."
  exit -1
fi

yarn check --integrity --verify-tree
(cd client && yarn check --integrity --verify-tree)

version="v$1"
github_prerelease_option=""
if [[ "$version" = *"-alpha."* ]] || [[ "$version" = *"-beta."* ]] || [[ "$version" = *"-rc."* ]]; then
  echo -e "This is a pre-release.\n"
  github_prerelease_option="--pre-release"
fi

directory_name="peertube-$version"
zip_name="peertube-$version.zip"
tar_name="peertube-$version.tar.xz"

changelog=$(awk -v version="$version" '/## v/ { printit = $2 == version }; printit;' CHANGELOG.md | grep -v "## $version" | sed '1{/^$/d}')

printf "Changelog will be:\\n\\n%s\\n\\n" "$changelog"

read -p "Are you sure to release? " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 0
fi

(
  cd client
  npm version --no-git-tag-version --no-commit-hooks "$1"
)

npm version -f --no-git-tag-version --no-commit-hooks "$1"

git commit package.json client/package.json ./support/doc/api/openapi.yaml -m "Bumped to version $version"
git tag -s -a "$version" -m "$version"

npm run build -- --source-map
rm -f "./client/dist/en-US/stats.json"
rm -f "./client/dist/embed-stats.json"

# Clean up declaration files
find dist/ packages/core-utils/dist/ \
  packages/ffmpeg/dist/ \
  packages/node-utils/dist/ \
  packages/models/dist/ \
  \( -name '*.d.ts' -o -name '*.d.ts.map' \) -type f -delete

# Creating the archives
(
  # local variables
  directories_to_archive=("$directory_name/CREDITS.md" "$directory_name/FAQ.md" \
                          "$directory_name/LICENSE" "$directory_name/README.md" \
                          "$directory_name/packages/core-utils/dist/" "$directory_name/packages/core-utils/package.json" \
                          "$directory_name/packages/ffmpeg/dist/" "$directory_name/packages/ffmpeg/package.json" \
                          "$directory_name/packages/node-utils/dist/" "$directory_name/packages/node-utils/package.json" \
                          "$directory_name/packages/models/dist/" "$directory_name/packages/models/package.json" \
                          "$directory_name/client/dist/" "$directory_name/client/yarn.lock" \
                          "$directory_name/client/package.json" "$directory_name/config" \
                          "$directory_name/dist" "$directory_name/package.json" \
                          "$directory_name/scripts/upgrade.sh" "$directory_name/support" \
                          "$directory_name/yarn.lock")

  # temporary setup
  cd ..
  ln -s "$peertube_directory" "$directory_name"

  # archive creation + signing
  zip -9 -r "$peertube_directory/$zip_name" "${directories_to_archive[@]}"
  gpg --armor --detach-sign -u "$maintainer_public_key" "$peertube_directory/$zip_name"
  XZ_OPT="-e9 -T0" tar cfJ "$peertube_directory/$tar_name" "${directories_to_archive[@]}"
  gpg --armor --detach-sign -u "$maintainer_public_key" "$peertube_directory/$tar_name"

  # temporary setup destruction
  rm "$directory_name"
)

# Creating the release on GitHub, with the created archives
(
  git push origin --tag

  if [ -z "$github_prerelease_option" ]; then
    github-release release --user chocobozzz --repo peertube --tag "$version" --name "$version" --description "$changelog"
  else
    github-release release --user chocobozzz --repo peertube --tag "$version" --name "$version" --description "$changelog" "$github_prerelease_option"
  fi

  # Wait for the release to be published, we had some issues when the files were not uploaded because of "unknown release" error
  sleep 2

  github-release upload --user chocobozzz --repo peertube --tag "$version" --name "$zip_name" --file "$zip_name"
  github-release upload --user chocobozzz --repo peertube --tag "$version" --name "$zip_name.asc" --file "$zip_name.asc"
  github-release upload --user chocobozzz --repo peertube --tag "$version" --name "$tar_name" --file "$tar_name"
  github-release upload --user chocobozzz --repo peertube --tag "$version" --name "$tar_name.asc" --file "$tar_name.asc"

  git push origin "$branch"

  # Only update master if it is not a pre release
  if [ -z "$github_prerelease_option" ]; then
      # Update master branch
      git checkout master
      git merge "$branch"
      git push origin master
      git checkout "$branch"

      # Rebuild properly the server, with the declaration files
      npm run build:server
      # Release types package
      npm run generate-types-package "$version"
      cd packages/types-generator/dist
      npm publish --access public
  fi
)
