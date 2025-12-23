# Changelog

## v0.4.0

 * Copy codecs for HLS transcoding if possible

## v0.3.0

 * Add generate storyboard support (PeerTube >= 8.0)

## v0.2.0

 * Add runner version in request and register payloads
 * Update dependencies to fix vulnerabilities

## v0.1.3

 * Disable log coloring when TTY does not support it
 * Add download file timeout (2 hours) to prevent stuck jobs

## v0.1.2

  * Support query params in custom upload URL

## v0.1.1

  * Fix adding studio watermark with audio/video split HLS file

## v0.1.0

  * Requires Node 20
  * Introduce `list-jobs` command to list processing jobs
  * Update dependencies
  * Send last chunks/playlist content to correctly end the live
