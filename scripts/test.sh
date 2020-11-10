#!/bin/sh

set -eu

npm run build:server
npm run setup:cli

npm run ci -- lint

npm run ci -- misc
npm run ci -- cli
npm run ci -- api-1
npm run ci -- api-2
npm run ci -- api-3
npm run ci -- api-4
npm run ci -- external-plugins
