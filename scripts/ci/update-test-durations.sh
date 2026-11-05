#!/bin/bash

set -eu

# Update test-durations.txt from the logs of a successful run of the GitHub "Test" workflow
# Usage: ./scripts/ci/update-test-durations.sh <run id>

if [ $# -eq 0 ]; then
    echo "Need GitHub run id argument."
    exit 1
fi

cd "$(dirname "$0")/../.."

durationsFile="scripts/ci/test-durations.txt"

newDurations=$(gh run view "$1" -R Chocobozzz/PeerTube --log | grep -oE '\[test-duration\] [^ ]+ [0-9]+$' | cut -d ' ' -f 2-)

if [ -z "$newDurations" ]; then
    echo "No test durations found in run $1."
    exit 1
fi

# New durations override existing ones, and remove files that do not exist anymore
printf '%s\n' "$newDurations" | cat - "$durationsFile" | awk '!seen[$1]++' | while read -r key duration; do
    [ -f "packages/tests/src/$key.ts" ] && echo "$key $duration"
done | sort -k2,2nr -k1,1 > "$durationsFile.tmp"

mv "$durationsFile.tmp" "$durationsFile"

echo "Updated $(printf '%s\n' "$newDurations" | wc -l) durations in $durationsFile."
