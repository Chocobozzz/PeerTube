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
    logger.debug(`Running video stats buffer scheduler`, lTags())

    const videoIds = await Redis.Instance.listLocalVideosWithStats()
    if (videoIds.length === 0) return

    for (const videoId of videoIds) {
      try {
        const views = await Redis.Instance.getLocalVideoStats('views', videoId)
        const downloads = await Redis.Instance.getLocalVideoStats('downloads', videoId)

        await Redis.Instance.deleteLocalVideoStats(videoId)

        if (!views && !downloads) continue

        const video = await VideoModel.loadFull(videoId)
        if (!video) {
          logger.debug(`Video ${videoId} does not exist anymore, skipping videos stats addition.`, lTags())
          continue
        }

        logger.info(`Processing local video ${video.uuid} stats buffer.`, lTags(video.uuid))

        // If this is a remote video, the origin instance will send us an update
        if (views) {
          video.views += views
          await VideoModel.incrementStats('views', videoId, views)
        }

        if (downloads) {
          video.downloads += downloads
          await VideoModel.incrementStats('downloads', videoId, downloads)
        }

        // Send video update
        await federateVideoIfNeeded(video, false)
      } catch (err) {
        logger.error(`Cannot process local video stats buffer of video ${videoId}.`, { err, ...lTags() })
      }
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
