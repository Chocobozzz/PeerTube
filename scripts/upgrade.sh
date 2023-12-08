#!/bin/sh

set -eu

# Backward path compatibility now upgrade.sh is in dist/scripts since v6

/bin/sh ../dist/scripts/upgrade.sh ${1:-/var/www/peertube}

