#!/bin/sh
set -e


find /config ! -user peertube -exec chown peertube:peertube {} \; || true

# first arg is `-f` or `--some-option`
# or first arg is `something.conf`
if [ "${1#-}" != "$1" ] || [ "${1%.conf}" != "$1" ]; then
    set -- node "$@"
fi

# allow the container to be started with `--user`
if [ "$1" = 'node' -a "$(id -u)" = '0' ]; then
    find /data ! -user peertube -exec  chown peertube:peertube {} \;
    exec gosu peertube "$0" "$@"
fi

exec "$@"
