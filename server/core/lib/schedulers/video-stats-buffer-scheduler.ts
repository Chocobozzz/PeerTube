import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VideoModel } from '@server/models/video/video.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { federateVideoIfNeeded } from '../activitypub/videos/index.js'
import { Redis } from '../redis.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers', 'stats')

/**
 * Increment video counters in the database with the pending values stored in Redis, and send video updates if needed
 */

export class VideoStatsBufferScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.VIDEO_STATS_BUFFER_UPDATE

  private constructor () {
    super({ randomRunOnEnable: false })
  }

  protected async internalExecute () {
    for (const statKind of [ 'views', 'downloads' ] as const) {
      logger.debug(`Running video stats buffer scheduler for '${statKind}'`, lTags())

      const videoIds = await Redis.Instance.listLocalVideosWithStats(statKind)
      if (videoIds.length === 0) return

      for (const videoId of videoIds) {
        try {
          const views = await Redis.Instance.getLocalVideoStats(statKind, videoId)
          await Redis.Instance.deleteLocalVideoStats(statKind, videoId)

          const video = await VideoModel.loadFull(videoId)
          if (!video) {
            logger.debug(`Video ${videoId} does not exist anymore, skipping videos ${statKind} addition.`, lTags())
            continue
          }

          logger.info(`Processing local video ${video.uuid} ${statKind} buffer.`, lTags(video.uuid))

          // If this is a remote video, the origin instance will send us an update
          await VideoModel.incrementStats(statKind, videoId, views)

          // Send video update
          video.views += views
          await federateVideoIfNeeded(video, false)
        } catch (err) {
          logger.error(`Cannot process local video ${statKind} buffer of video ${videoId}.`, { err, ...lTags() })
        }
      }
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
