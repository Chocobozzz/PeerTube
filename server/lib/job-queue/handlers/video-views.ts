import { Redis } from '../../redis'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import { VideoViewModel } from '../../../models/video/video-views'
import { isTestInstance } from '../../../helpers/core-utils'
import { federateVideoIfNeeded } from '../../activitypub'

async function processVideosViews () {
  const lastHour = new Date()

  // In test mode, we run this function multiple times per hour, so we don't want the values of the previous hour
  if (!isTestInstance()) lastHour.setHours(lastHour.getHours() - 1)

  const hour = lastHour.getHours()
  const startDate = lastHour.setMinutes(0, 0, 0)
  const endDate = lastHour.setMinutes(59, 59, 999)

  const videoIds = await Redis.Instance.getVideosIdViewed(hour)
  if (videoIds.length === 0) return

  logger.info('Processing videos views in job for hour %d.', hour)

  for (const videoId of videoIds) {
    try {
      const views = await Redis.Instance.getVideoViews(videoId, hour)
      if (views) {
        logger.debug('Adding %d views to video %d in hour %d.', views, videoId, hour)

        try {
          await VideoViewModel.create({
            startDate,
            endDate,
            views,
            videoId
          })

          const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
          if (video.isOwned()) {
            // If this is a remote video, the origin instance will send us an update
            await VideoModel.incrementViews(videoId, views)

            // Send video update
            video.views += views
            await federateVideoIfNeeded(video, false)
          }
        } catch (err) {
          logger.debug('Cannot create video views for video %d in hour %d. Maybe the video does not exist anymore?', videoId, hour)
        }
      }

      await Redis.Instance.deleteVideoViews(videoId, hour)
    } catch (err) {
      logger.error('Cannot update video views of video %d in hour %d.', videoId, hour)
    }
  }
}

// ---------------------------------------------------------------------------

export {
  processVideosViews
}
