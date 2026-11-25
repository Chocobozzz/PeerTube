#!/bin/sh

set -eu

# Backward path compatibility now upgrade.sh is in dist/scripts since v6

exec /bin/sh ../dist/scripts/upgrade.sh "$@"

