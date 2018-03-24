#!/bin/bash

set -eu

shutdown() {
  # Get our process group id
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

branch=$(git symbolic-ref --short -q HEAD)
if [ "$branch" != "develop" ]; then
  echo "Need to be on develop branch."
  exit -1
fi

version="v$1"
directory_name="peertube-$version"
zip_name="peertube-$version.zip"

changelog=$(awk -v version="$version" '/## v/ { printit = $2 == version }; printit;' CHANGELOG.md | grep -v "$version" | sed '1{/^$/d}')

printf "Changelog will be:\n%s\n" "$changelog"

read -p "Are you sure to release? " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
  exit 0
fi

( cd client
  npm version --no-git-tag-version --no-commit-hooks "$1"
)

npm version -f --no-git-tag-version --no-commit-hooks "$1"

git commit package.json client/package.json -m "Bumped to version $version"
git tag -s -a "$version" -m "$version"

npm run build
rm "./client/dist/stats.json"

cd ..

ln -s "PeerTube" "$directory_name"
zip -r "PeerTube/$zip_name" "$directory_name/CREDITS.md" "$directory_name/FAQ.md" \
                            "$directory_name/LICENSE" "$directory_name/README.md" \
                            "$directory_name/client/dist/" "$directory_name/client/yarn.lock" \
                            "$directory_name/client/package.json" "$directory_name/config" \
                            "$directory_name/dist" "$directory_name/package.json" \
                            "$directory_name/scripts" "$directory_name/support" \
                            "$directory_name/tsconfig.json" "$directory_name/yarn.lock"

rm "$directory_name"

cd "PeerTube"

git push origin --tag

github-release release --user chocobozzz --repo peertube --tag "$version" --name "$version" --description "$changelog"
github-release upload --user chocobozzz --repo peertube --tag "$version" --name "$zip_name" --file "$zip_name"

git push origin develop

# Update master branch
git checkout master
git rebase develop
git push origin master
git checkout develop

