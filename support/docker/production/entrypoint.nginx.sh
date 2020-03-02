#!/bin/sh
set -e

# Process nginx template
SOURCE="/etc/nginx/conf.d/peertube.template"
TARGET="/etc/nginx/conf.d/default.conf"
export WEBSERVER_HOST="default_server"
export PEERTUBE_HOST="peertube:9000"

envsubst '${WEBSERVER_HOST} ${PEERTUBE_HOST}' < $SOURCE > $TARGET

# Remove HTTPS/SSL from nginx conf
sed -i 's/443 ssl http2/80/g;/ssl_/d' $TARGET

cat $TARGET

nginx -g "daemon off;"