#!/bin/sh
set -e

# Process the nginx template
SOURCE_FILE="/etc/nginx/conf.d/peertube.template"
TARGET_FILE="/etc/nginx/conf.d/default.conf"
export WEBSERVER_HOST="$PEERTUBE_WEBSERVER_HOSTNAME"
export PEERTUBE_HOST="peertube:9000"

envsubst '${WEBSERVER_HOST} ${PEERTUBE_HOST}' < $SOURCE_FILE > $TARGET_FILE

while :; do
  sleep 12h & wait $!;
  nginx -s reload;
done &

nginx -g 'daemon off;'
