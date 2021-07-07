#!/bin/sh

set -eu

printf "############# PeerTube help #############\n\n"
printf "npm run ...\n"
printf "  build                       -> Build the application for production (alias of build:client:prod)\n"
printf "  build:server                -> Build the server for production\n"
printf "  build:client                -> Build the client for production\n"
printf "  clean:client                -> Clean the client build files (dist directory)\n"
printf "  clean:server:test           -> Clean logs, uploads, database... of the test instances\n"
printf "  reset-password -- -u [user] -> Reset the password of user [user]\n"
printf "  create-transcoding-job -- -v [video UUID] \n"
printf "                              -> Create a transcoding job for a particular video\n"
printf "  prune-storage               -> Delete (after confirmation) unknown video files/thumbnails/previews... (due to a bad video deletion, transcoding job not finished...)\n"
printf "  optimize-old-videos         -> Re-transcode videos that have a high bitrate, to make them suitable for streaming over slow connections"
printf "  dev                         -> Watch, run the livereload and run the server so that you can develop the application\n"
printf "  start                       -> Run the server\n"
printf "  update-host                 -> Upgrade scheme/host in torrent files according to the webserver configuration (config/ folder)\n"
printf "  client-report               -> Open a report of the client dependencies module\n"
printf "  test                        -> Run the tests\n"
printf "  help                        -> Print this help\n"
