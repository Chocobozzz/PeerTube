#!/bin/sh
set -e

# first arg is `-f` or `--some-option`
# or first arg is `something.conf`
if [ "${1#-}" != "$1" ] || [ "${1%.conf}" != "$1" ]; then
        set -- npm "$@"
fi

# allow the container to be started with `--user`
if [ "$1" = 'npm' -a "$(id -u)" = '0' ]; then
        chown -R peertube: /data
        exec gosu peertube "$0" "$@"
fi

exec "$@"
