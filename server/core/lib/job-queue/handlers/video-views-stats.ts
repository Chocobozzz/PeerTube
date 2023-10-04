import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { VideoViewModel } from '@server/models/view/video-view.js'
import { logger } from '../../../helpers/logger.js'
import { VideoModel } from '../../../models/video/video.js'
import { Redis } from '../../redis.js'

async function processVideosViewsStats () {
  const lastHour = new Date()

  // In test mode, we run this function multiple times per hour, so we don't want the values of the previous hour
  if (!isTestOrDevInstance()) lastHour.setHours(lastHour.getHours() - 1)

  const hour = lastHour.getHours()
  const startDate = lastHour.setMinutes(0, 0, 0)
  const endDate = lastHour.setMinutes(59, 59, 999)

  const videoIds = await Redis.Instance.listVideosViewedForStats(hour)
  if (videoIds.length === 0) return

  logger.info('Processing videos views stats in job for hour %d.', hour)

  for (const videoId of videoIds) {
    try {
      const views = await Redis.Instance.getVideoViewsStats(videoId, hour)
      await Redis.Instance.deleteVideoViewsStats(videoId, hour)

      if (views) {
        logger.debug('Adding %d views to video %d stats in hour %d.', views, videoId, hour)

        try {
          const video = await VideoModel.load(videoId)
          if (!video) {
            logger.debug('Video %d does not exist anymore, skipping videos view stats.', videoId)
            continue
          }

          await VideoViewModel.create({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            views,
            videoId
          })
        } catch (err) {
          logger.error('Cannot create video views stats for video %d in hour %d.', videoId, hour, { err })
        }
      }
    } catch (err) {
      logger.error('Cannot update video views stats of video %d in hour %d.', videoId, hour, { err })
    }
  }
}

// ---------------------------------------------------------------------------

export {
  processVideosViewsStats
}
