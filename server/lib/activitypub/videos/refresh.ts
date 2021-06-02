import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { PeerTubeRequestError } from '@server/helpers/requests'
import { VideoFetchByUrlType } from '@server/helpers/video'
import { ActorFollowScoreCache } from '@server/lib/files-cache'
import { VideoModel } from '@server/models/video/video'
import { MVideoAccountLightBlacklistAllFiles, MVideoThumbnail } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils'
import { fetchRemoteVideo, SyncParam, syncVideoExternalAttributes } from './shared'
import { APVideoUpdater } from './updater'

const lTags = loggerTagsFactory('ap', 'video', 'refresh')

async function refreshVideoIfNeeded (options: {
  video: MVideoThumbnail
  fetchedType: VideoFetchByUrlType
  syncParam: SyncParam
}): Promise<MVideoThumbnail> {
  if (!options.video.isOutdated()) return options.video

  // We need more attributes if the argument video was fetched with not enough joints
  const video = options.fetchedType === 'all'
    ? options.video as MVideoAccountLightBlacklistAllFiles
    : await VideoModel.loadByUrlAndPopulateAccount(options.video.url)

  try {
    const { videoObject } = await fetchRemoteVideo(video.url)

    if (videoObject === undefined) {
      logger.warn('Cannot refresh remote video %s: invalid body.', video.url, lTags(video.uuid))

      await video.setAsRefreshed()
      return video
    }

    const videoUpdater = new APVideoUpdater(videoObject, video)
    await videoUpdater.update()

    await syncVideoExternalAttributes(video, videoObject, options.syncParam)

    ActorFollowScoreCache.Instance.addGoodServerId(video.VideoChannel.Actor.serverId)

    return video
  } catch (err) {
    if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
      logger.info('Cannot refresh remote video %s: video does not exist anymore. Deleting it.', video.url, lTags(video.uuid))

      // Video does not exist anymore
      await video.destroy()
      return undefined
    }

    logger.warn('Cannot refresh video %s.', options.video.url, { err, ...lTags(video.uuid) })

    ActorFollowScoreCache.Instance.addBadServerId(video.VideoChannel.Actor.serverId)

    // Don't refresh in loop
    await video.setAsRefreshed()
    return video
  }
}

// ---------------------------------------------------------------------------

export {
  refreshVideoIfNeeded
}
