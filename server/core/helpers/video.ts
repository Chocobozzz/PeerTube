import { VideoPrivacy } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { isStreamingPlaylist, MStreamingPlaylistVideo, MVideo } from '@server/types/models/index.js'
import { Response } from 'express'

export function getVideoWithAttributes (res: Response) {
  return res.locals.videoAPI || res.locals.videoAll || res.locals.onlyVideo
}

export function extractVideo (videoOrPlaylist: MVideo | MStreamingPlaylistVideo) {
  return isStreamingPlaylist(videoOrPlaylist)
    ? videoOrPlaylist.Video
    : videoOrPlaylist
}

export function getPrivaciesForFederation () {
  return (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true)
    ? [ { privacy: VideoPrivacy.PUBLIC }, { privacy: VideoPrivacy.UNLISTED } ]
    : [ { privacy: VideoPrivacy.PUBLIC } ]
}

export function getExtFromMimetype (mimeTypes: { [id: string]: string | string[] }, mimeType: string) {
  const value = mimeTypes[mimeType]

  if (Array.isArray(value)) return value[0]

  return value
}
