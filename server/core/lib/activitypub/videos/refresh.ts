import { HttpStatusCode } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { getRemoteErrorLogLevel } from '@server/helpers/remote-errors.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoAccountLightBlacklistAllFiles, MVideoThumbnails } from '@server/types/models/index.js'
import { ActorFollowHealthCache } from '../../actor-follow-health-cache.js'
import { runWithAPObjectLock } from '../ap-object-lock.js'
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
  syncParam: SyncParam
}): Promise<MVideoThumbnails> {
  if (!options.video.isOutdated()) return options.video

  const videoUrl = options.video.url

  // Inner functions (fetchRemoteVideo, APVideoUpdater...) inherit these tags without having to inject them
  return logger.withContext([ options.video.uuid, videoUrl ], async () => {
    const { video, updated, videoObject } = await runWithAPObjectLock(videoUrl, async () => {
      // Reload the video in the lock: an activity may have updated or deleted it in the meantime
      const video = await VideoModel.loadByUrlAndPopulateAccountAndFiles(videoUrl)
      if (!video) return { video: undefined, updated: false }
      if (!video.isOutdated()) return { video, updated: false }

      logger.info('Refreshing video %s.', videoUrl)

      try {
        const result = await fetchRemoteVideo(videoUrl)
        const videoObject = result.videoObject

        if (videoObject === undefined) {
          logger.warn('Cannot refresh remote video %s: invalid body.', videoUrl)

          await video.setAsRefreshed()
          return { video, updated: false }
        }

        const videoUpdater = new APVideoUpdater(result.videoObject, video, videoUrl)
        const videoUpdated = await videoUpdater.update({ isLatestStateFromOrigin: true })

        // Not updated (e.g. invalid context): don't refresh in loop
        if (!videoUpdated) {
          await video.setAsRefreshed()
          return { video, updated: false, videoObject }
        }

        await ActorFollowHealthCache.Instance.addGoodServerId(video.VideoChannel.Actor.serverId)

        return { videoObject: result.videoObject, video, updated: videoUpdated }
      } catch (err) {
        const videoAfterRefresh = await handleRefreshError(video, err)

        return { video: videoAfterRefresh, updated: false }
      }
    })

    // Outside the lock, crawling comments, shares and rates can take a long time
    if (video && updated && videoObject) {
      await syncVideoExternalAttributes(video, videoObject, options.syncParam)
    }

    return video
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function handleRefreshError (video: MVideoAccountLightBlacklistAllFiles, err: any) {
  const statusCode = (err as PeerTubeRequestError).statusCode

  if (statusCode === HttpStatusCode.NOT_FOUND_404 || statusCode === HttpStatusCode.GONE_410) {
    logger.info('Cannot refresh remote video %s: video does not exist anymore (404/410 error code). Deleting it.', video.url)

    // Video does not exist anymore
    await video.destroy()
    return undefined
  }

  logger.log(getRemoteErrorLogLevel(err), 'Cannot refresh video %s.', video.url, { err })

  await ActorFollowHealthCache.Instance.addBadServerId(video.VideoChannel.Actor.serverId)

  // Don't refresh in loop
  await video.setAsRefreshed()
  return video
}
