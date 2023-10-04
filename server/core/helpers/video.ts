import { Response } from 'express'
import { forceNumber } from '@peertube/peertube-core-utils'
import { VideoPrivacy, VideoPrivacyType, VideoState, VideoStateType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { isStreamingPlaylist, MStreamingPlaylistVideo, MVideo } from '@server/types/models/index.js'

function getVideoWithAttributes (res: Response) {
  return res.locals.videoAPI || res.locals.videoAll || res.locals.onlyVideo
}

function extractVideo (videoOrPlaylist: MVideo | MStreamingPlaylistVideo) {
  return isStreamingPlaylist(videoOrPlaylist)
    ? videoOrPlaylist.Video
    : videoOrPlaylist
}

function isPrivacyForFederation (privacy: VideoPrivacyType) {
  const castedPrivacy = forceNumber(privacy)

  return castedPrivacy === VideoPrivacy.PUBLIC ||
    (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true && castedPrivacy === VideoPrivacy.UNLISTED)
}

function isStateForFederation (state: VideoStateType) {
  const castedState = forceNumber(state)

  return castedState === VideoState.PUBLISHED || castedState === VideoState.WAITING_FOR_LIVE || castedState === VideoState.LIVE_ENDED
}

function getPrivaciesForFederation () {
  return (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true)
    ? [ { privacy: VideoPrivacy.PUBLIC }, { privacy: VideoPrivacy.UNLISTED } ]
    : [ { privacy: VideoPrivacy.PUBLIC } ]
}

function getExtFromMimetype (mimeTypes: { [id: string]: string | string[] }, mimeType: string) {
  const value = mimeTypes[mimeType]

  if (Array.isArray(value)) return value[0]

  return value
}

export {
  getVideoWithAttributes,
  extractVideo,
  getExtFromMimetype,
  isStateForFederation,
  isPrivacyForFederation,
  getPrivaciesForFederation
}
