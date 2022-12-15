#!/bin/sh

set -eu

npm run ci -- types
npm run ci -- client
npm run ci -- cli-plugin
npm run ci -- api-1
npm run ci -- api-2
npm run ci -- api-3
npm run ci -- api-4
npm run ci -- api-5
npm run ci -- external-plugins

npm run ci -- lint
