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

export function peertubeLicenceToSPDX (licence: number) {
  return {
    1: 'CC-BY-4.0',
    2: 'CC-BY-SA-4.0',
    3: 'CC-BY-ND-4.0',
    4: 'CC-BY-NC-4.0',
    5: 'CC-BY-NC-SA-4.0',
    6: 'CC-BY-NC-ND-4.0',
    7: 'CC0'
  }[licence]
}

export function spdxToPeertubeLicence (licence: string) {
  return {
    'CC-BY-4.0': 1,
    'CC-BY-SA-4.0': 2,
    'CC-BY-ND-4.0': 3,
    'CC-BY-NC-4.0': 4,
    'CC-BY-NC-SA-4.0': 5,
    'CC-BY-NC-ND-4.0': 6,
    'CC0': 7
  }[licence]
}
