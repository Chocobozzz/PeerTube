#!/bin/bash
set -e

# Populate config directory
if [ -z "$(ls -A /config)" ]; then
    cp /app/support/docker/production/config/* /config
fi

# Always copy default and custom env configuration file, in cases where new keys were added
cp /app/config/default.yaml /config
cp /app/support/docker/production/config/custom-environment-variables.yaml /config
chown -R peertube:peertube /config

# As trust_proxy is a yaml array in configuration and docker env doesn't allow array
# we need to parse the env variable PEERTUBE_TRUST_PROXY ourselves
# then write the array directly in the config file.
# This part deals with PEERTUBE_TRUST_PROXY env variable only
if [ ! -z "${PEERTUBE_TRUST_PROXY}" ]; then
    # We need to replace space by comma
    TRUST_PROXY="[${PEERTUBE_TRUST_PROXY// /,}]"
    # Push the trust_proxy conf to production.yaml and remove old config
    awk -v var="${TRUST_PROXY}" 's{if(/\s*-\s*.*/) next; else s=0}  /trust_proxy:/{print "trust_proxy: " var; s=1; next} 1' /config/production.yaml > /config/temp-production.yaml
    # We use cat to override some filesystem problem with cp
    cat /config/temp-production.yaml > /config/production.yaml
    rm /config/temp-production.yaml
fi
# After modifying the config file, chown again to solve some security problems (k8s security context versus raw docker env)
chown -R peertube:peertube /config

# first arg is `-f` or `--some-option`
# or first arg is `something.conf`
if [ "${1#-}" != "$1" ] || [ "${1%.conf}" != "$1" ]; then
    set -- npm "$@"
fi

# allow the container to be started with `--user`
if [ "$1" = 'npm' -a "$(id -u)" = '0' ]; then
    chown -R peertube:peertube /data
    exec gosu peertube "$0" "$@"
fi

exec "$@"
