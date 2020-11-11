#!/bin/sh
set -e

# Process the nginx template
SOURCE_FILE="/etc/nginx/conf.d/peertube.template"
TARGET_FILE="/etc/nginx/conf.d/default.conf"
export WEBSERVER_HOST="default_server"
export PEERTUBE_HOST="peertube:9000"

envsubst '${WEBSERVER_HOST} ${PEERTUBE_HOST}' < $SOURCE_FILE > $TARGET_FILE

# Remove HTTPS/SSL from nginx conf since this image is meant as a webserver _behind_ a reverse-proxy doing TLS termination itself
sed -i 's/443 ssl http2/80/g;/ssl_/d' $TARGET_FILE

nginx -g "daemon off;"