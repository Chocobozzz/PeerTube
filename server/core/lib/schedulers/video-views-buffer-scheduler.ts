import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VideoModel } from '@server/models/video/video.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { federateVideoIfNeeded } from '../activitypub/videos/index.js'
import { Redis } from '../redis.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('views')

export class VideoViewsBufferScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.VIDEO_VIEWS_BUFFER_UPDATE

  private constructor () {
    super()
  }

  protected async internalExecute () {
    const videoIds = await Redis.Instance.listLocalVideosViewed()
    if (videoIds.length === 0) return

    for (const videoId of videoIds) {
      try {
        const views = await Redis.Instance.getLocalVideoViews(videoId)
        await Redis.Instance.deleteLocalVideoViews(videoId)

        const video = await VideoModel.loadFull(videoId)
        if (!video) {
          logger.debug('Video %d does not exist anymore, skipping videos view addition.', videoId, lTags())
          continue
        }

        logger.info('Processing local video %s views buffer.', video.uuid, lTags(video.uuid))

        // If this is a remote video, the origin instance will send us an update
        await VideoModel.incrementViews(videoId, views)

        // Send video update
        video.views += views
        await federateVideoIfNeeded(video, false)
      } catch (err) {
        logger.error('Cannot process local video views buffer of video %d.', videoId, { err, ...lTags() })
      }
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
