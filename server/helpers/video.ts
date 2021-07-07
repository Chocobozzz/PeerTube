import { Response } from 'express'
import { CONFIG } from '@server/initializers/config'
import { isStreamingPlaylist, MStreamingPlaylistVideo, MVideo } from '@server/types/models'
import { VideoPrivacy, VideoState } from '@shared/models'

function getVideoWithAttributes (res: Response) {
  return res.locals.videoAPI || res.locals.videoAll || res.locals.onlyVideo
}

function extractVideo (videoOrPlaylist: MVideo | MStreamingPlaylistVideo) {
  return isStreamingPlaylist(videoOrPlaylist)
    ? videoOrPlaylist.Video
    : videoOrPlaylist
}

function isPrivacyForFederation (privacy: VideoPrivacy) {
  const castedPrivacy = parseInt(privacy + '', 10)

  return castedPrivacy === VideoPrivacy.PUBLIC ||
    (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true && castedPrivacy === VideoPrivacy.UNLISTED)
}

function isStateForFederation (state: VideoState) {
  const castedState = parseInt(state + '', 10)

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
