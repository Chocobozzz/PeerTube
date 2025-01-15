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
peertube_directory=$(basename $(pwd))

npm run build -- --source-map

# Clean up declaration files
find dist/ packages/core-utils/dist/ \
  packages/ffmpeg/dist/ \
  packages/node-utils/dist/ \
  packages/models/dist/ \
  \( -name '*.d.ts' -o -name '*.d.ts.map' \) -type f -delete

nightly_version="nightly-$today"
sed -i 's/"version": "\([^"]\+\)"/"version": "\1-'"$nightly_version"'"/' ./package.json

# Creating the archives
(
  # local variables
  directories_to_archive=("$directory_name/CREDITS.md" "$directory_name/FAQ.md" \
                          "$directory_name/LICENSE" "$directory_name/README.md" \
                          "$directory_name/packages/core-utils/dist/" "$directory_name/packages/core-utils/package.json" \
                          "$directory_name/packages/ffmpeg/dist/" "$directory_name/packages/ffmpeg/package.json" \
                          "$directory_name/packages/node-utils/dist/" "$directory_name/packages/node-utils/package.json" \
                          "$directory_name/packages/models/dist/" "$directory_name/packages/models/package.json" \
                          "$directory_name/packages/transcription/dist/" "$directory_name/packages/transcription/package.json" \
                          "$directory_name/client/dist/" "$directory_name/client/yarn.lock" \
                          "$directory_name/client/package.json" "$directory_name/config" \
                          "$directory_name/dist" "$directory_name/package.json" \
                          "$directory_name/scripts/upgrade.sh" "$directory_name/support/doc" "$directory_name/support/freebsd" \
                          "$directory_name/support/init.d" "$directory_name/support/nginx" "$directory_name/support/openapi" \
                          "$directory_name/support/sysctl.d" "$directory_name/support/systemd" \
                          "$directory_name/yarn.lock")

  # temporary setup
  cd ..
  ln -s "$peertube_directory" "$directory_name"

  XZ_OPT=-e9 tar cfJ "$peertube_directory/$tar_name" "${directories_to_archive[@]}"

  # temporary setup destruction
  rm "$directory_name"
)

git checkout -- ./package.json
