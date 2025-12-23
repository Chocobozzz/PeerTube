import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { VideoLoadByUrlType } from '@server/lib/model-loaders/index.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoAccountLightBlacklistAllFiles, MVideoThumbnail } from '@server/types/models/index.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import { ActorFollowHealthCache } from '../../actor-follow-health-cache.js'
import { fetchRemoteVideo, SyncParam, syncVideoExternalAttributes } from './shared/index.js'
import { APVideoUpdater } from './updater.js'

async function refreshVideoIfNeeded (options: {
  video: MVideoThumbnail
  fetchedType: VideoLoadByUrlType
  syncParam: SyncParam
}): Promise<MVideoThumbnail> {
  if (!options.video.isOutdated()) return options.video

  // We need more attributes if the argument video was fetched with not enough joints
  const video = options.fetchedType === 'all'
    ? options.video as MVideoAccountLightBlacklistAllFiles
    : await VideoModel.loadByUrlAndPopulateAccountAndFiles(options.video.url)

  const lTags = loggerTagsFactory('ap', 'video', 'refresh', video.uuid, video.url)

  logger.info('Refreshing video %s.', video.url, lTags())

  try {
    const { videoObject } = await fetchRemoteVideo(video.url)

    if (videoObject === undefined) {
      logger.warn('Cannot refresh remote video %s: invalid body.', video.url, lTags())

      await video.setAsRefreshed()
      return video
    }

    const videoUpdater = new APVideoUpdater(videoObject, video)
    await videoUpdater.update()

    await syncVideoExternalAttributes(video, videoObject, options.syncParam)

    ActorFollowHealthCache.Instance.addGoodServerId(video.VideoChannel.Actor.serverId)

    return video
  } catch (err) {
    const statusCode = (err as PeerTubeRequestError).statusCode

    if (statusCode === HttpStatusCode.NOT_FOUND_404 || statusCode === HttpStatusCode.GONE_410) {
      logger.info('Cannot refresh remote video %s: video does not exist anymore (404/410 error code). Deleting it.', video.url, lTags())

      // Video does not exist anymore
      await video.destroy()
      return undefined
    }

    logger.warn('Cannot refresh video %s.', options.video.url, { err, ...lTags() })

    ActorFollowHealthCache.Instance.addBadServerId(video.VideoChannel.Actor.serverId)

    // Don't refresh in loop
    await video.setAsRefreshed()
    return video
  }
}

// ---------------------------------------------------------------------------

export {
  refreshVideoIfNeeded
}
