#!/bin/sh

set -eu

npm run ci -- types-package
npm run ci -- client
npm run ci -- cli-plugin
npm run ci -- api-check-params-search
npm run ci -- api-videos-1
npm run ci -- api-videos-2
npm run ci -- api-server
npm run ci -- api-live-scalability
npm run ci -- api-users-stats
npm run ci -- api-moderation-notifications
npm run ci -- api-federation
npm run ci -- api-object-storage
npm run ci -- api-transcoding-1
npm run ci -- api-transcoding-2
npm run ci -- external-plugins
npm run ci -- transcription

npm run ci -- lint
