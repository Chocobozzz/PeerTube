
import { VideoModel } from '@server/models/video/video'
import { FilteredModelAttributes } from '@server/types'
import { VideoCreate, VideoPrivacy, VideoState } from '@shared/models'

function buildLocalVideoFromCreate (videoInfo: VideoCreate, channelId: number): FilteredModelAttributes<VideoModel> {
  return {
    name: videoInfo.name,
    remote: false,
    category: videoInfo.category,
    licence: videoInfo.licence,
    language: videoInfo.language,
    commentsEnabled: videoInfo.commentsEnabled !== false, // If the value is not "false", the default is "true"
    downloadEnabled: videoInfo.downloadEnabled !== false,
    waitTranscoding: videoInfo.waitTranscoding || false,
    state: VideoState.WAITING_FOR_LIVE,
    nsfw: videoInfo.nsfw || false,
    description: videoInfo.description,
    support: videoInfo.support,
    privacy: videoInfo.privacy || VideoPrivacy.PRIVATE,
    duration: 0,
    channelId: channelId,
    originallyPublishedAt: videoInfo.originallyPublishedAt
  }
}

// ---------------------------------------------------------------------------

export {
  buildLocalVideoFromCreate
}
