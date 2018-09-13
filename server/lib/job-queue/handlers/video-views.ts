import { Redis } from '../../redis'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import { VideoViewModel } from '../../../models/video/video-views'

async function processVideosViewsViews () {
  const hour = new Date().getHours()
  const startDate = new Date().setMinutes(0, 0, 0)
  const endDate = new Date().setMinutes(59, 59, 999)

  const videoIds = await Redis.Instance.getVideosIdViewed(hour)
  if (videoIds.length === 0) return

  logger.info('Processing videos views in job for hour %d.', hour)

  for (const videoId of videoIds) {
    try {
      const views = await Redis.Instance.getVideoViews(videoId, hour)
      if (isNaN(views)) {
        logger.error('Cannot process videos views of video %d in hour %d: views number is NaN.', videoId, hour)
      } else {
        logger.debug('Adding %d views to video %d in hour %d.', views, videoId, hour)

        await VideoModel.incrementViews(videoId, views)

        try {
          await VideoViewModel.create({
            startDate,
            endDate,
            views,
            videoId
          })
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
  processVideosViewsViews
}
