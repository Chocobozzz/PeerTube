import { HttpStatusCode } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { VideoLoadByUrlType } from '@server/lib/model-loaders/index.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoAccountLightBlacklistAllFiles, MVideoThumbnails } from '@server/types/models/index.js'
import { ActorFollowHealthCache } from '../../actor-follow-health-cache.js'
import { fetchRemoteVideo, SyncParam, syncVideoExternalAttributes } from './shared/index.js'
import { APVideoUpdater } from './updater.js'

const logger = createLogger('ap', 'video', 'refresh')

export function scheduleVideoRefreshIfNeeded (video: MVideo) {
  if (!video.isOutdated()) return

  JobQueue.Instance.createJobAsync({
    type: 'activitypub-refresher',
    deduplicationId: `video-refresh-${video.url}`,
    payload: { type: 'video', url: video.url }
  })
}

export async function refreshVideoIfNeeded (options: {
  video: MVideoThumbnails
  fetchedType: VideoLoadByUrlType
  syncParam: SyncParam
}): Promise<MVideoThumbnails> {
  if (!options.video.isOutdated()) return options.video

  // We need more attributes if the argument video was fetched with not enough joints
  const video = options.fetchedType === 'full'
    ? options.video as MVideoAccountLightBlacklistAllFiles
    : await VideoModel.loadByUrlAndPopulateAccountAndFiles(options.video.url)

  // Inner functions (fetchRemoteVideo, APVideoUpdater...) inherit these tags without having to inject them
  return logger.withContext([ video.uuid, video.url ], async () => {
    logger.info('Refreshing video %s.', video.url)

    try {
      const { videoObject } = await fetchRemoteVideo(video.url)

      if (videoObject === undefined) {
        logger.warn('Cannot refresh remote video %s: invalid body.', video.url)

        await video.setAsRefreshed()
        return video
      }

      const videoUpdater = new APVideoUpdater(videoObject, video, video.url)
      await videoUpdater.update()

      await syncVideoExternalAttributes(video, videoObject, options.syncParam)

      ActorFollowHealthCache.Instance.addGoodServerId(video.VideoChannel.Actor.serverId)

      return video
    } catch (err) {
      const statusCode = (err as PeerTubeRequestError).statusCode

      if (statusCode === HttpStatusCode.NOT_FOUND_404 || statusCode === HttpStatusCode.GONE_410) {
        logger.info('Cannot refresh remote video %s: video does not exist anymore (404/410 error code). Deleting it.', video.url)

        // Video does not exist anymore
        await video.destroy()
        return undefined
      }

      logger.warn('Cannot refresh video %s.', options.video.url, { err })

      ActorFollowHealthCache.Instance.addBadServerId(video.VideoChannel.Actor.serverId)

      // Don't refresh in loop
      await video.setAsRefreshed()
      return video
    }
  })
}
