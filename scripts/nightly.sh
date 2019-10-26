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

today=$(date '+%F')
directory_name="peertube-nightly-$today"
tar_name="peertube-nightly-$today.tar.xz"

npm run build

nightly_version="nightly-$today"
sed -i 's/"version": "\([^"]\+\)"/"version": "\1-'"$nightly_version"'"/' ./package.json

# Creating the archives
(
  # local variables
  directories_to_archive=("$directory_name/CREDITS.md" "$directory_name/FAQ.md" \
                          "$directory_name/LICENSE" "$directory_name/README.md" \
                          "$directory_name/client/dist/" "$directory_name/client/yarn.lock" \
                          "$directory_name/client/package.json" "$directory_name/config" \
                          "$directory_name/dist" "$directory_name/package.json" \
                          "$directory_name/scripts" "$directory_name/support" \
                          "$directory_name/tsconfig.json" "$directory_name/yarn.lock")

  # temporary setup
  cd ..
  ln -s "PeerTube" "$directory_name"

  XZ_OPT=-e9 tar cfJ "PeerTube/$tar_name" "${directories_to_archive[@]}"

  # temporary setup destruction
  rm "$directory_name"
)

git checkout -- ./package.json
