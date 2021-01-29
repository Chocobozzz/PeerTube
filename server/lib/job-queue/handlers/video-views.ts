import { Redis } from '../../redis'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import { VideoViewModel } from '../../../models/video/video-view'
import { federateVideoIfNeeded } from '../../activitypub/videos'

async function processVideosViews () {
  const lastHour = new Date()
  lastHour.setHours(lastHour.getHours() - 1)
  await Promise.all([
    new Date(),
    lastHour
  ].map(processVideosViewsForHour))
}

async function processVideosViewsForHour (date) {
  const hour = date.getHours()
  const startDate = date.setMinutes(0, 0, 0)
  const endDate = date.setMinutes(59, 59, 999)

  const videoIds = await Redis.Instance.getVideosIdViewed(hour)
  if (videoIds.length === 0) return

  logger.info('Processing videos views in job for hour %d.', hour)

  for (const videoId of videoIds) {
    try {
      const views = await Redis.Instance.getVideoViews(videoId, hour)
      await Redis.Instance.deleteVideoViews(videoId, hour)

      if (views) {
        try {
          const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
          if (!video) {
            logger.debug('Video %d does not exist anymore, skipping videos view addition.', videoId)
            continue
          }

          const videoView = await VideoViewModel.findOne({
            where: {
              startDate,
              endDate,
              videoId
            }
          })

          if (videoView) {
            logger.debug('Incrementing with %d views to video %d in hour %d.', views, videoId, hour)

            await VideoViewModel.increment('views', {
              by: views,
              where: {
                id: videoView.id
              }
            })
          } else {
            logger.debug('Adding %d views to video %d in hour %d.', views, videoId, hour)

            await VideoViewModel.create({
              startDate,
              endDate,
              views,
              videoId
            })
          }

          if (video.isOwned()) {
            // If this is a remote video, the origin instance will send us an update
            await VideoModel.incrementViews(videoId, views)

            // Send video update
            video.views += views
            await federateVideoIfNeeded(video, false)
          }
        } catch (err) {
          logger.error('Cannot create video views for video %d in hour %d.', videoId, hour, { err })
        }
      }
    } catch (err) {
      logger.error('Cannot update video views of video %d in hour %d.', videoId, hour, { err })
    }
  }
}

// ---------------------------------------------------------------------------

export {
  processVideosViews
}
