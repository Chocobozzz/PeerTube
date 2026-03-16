import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { VideoStatsModel } from '@server/models/stat/video-stats.js'
import { logger } from '../../../helpers/logger.js'
import { VideoModel } from '../../../models/video/video.js'
import { Redis } from '../../redis.js'

export async function processVideosStats () {
  const lastHour = new Date()

  // In test mode, we run this function multiple times per hour, so we don't want the values of the previous hour
  if (!isTestOrDevInstance()) lastHour.setHours(lastHour.getHours() - 1)

  const hour = lastHour.getHours()
  const startDate = lastHour.setMinutes(0, 0, 0)
  const endDate = lastHour.setMinutes(59, 59, 999)

  const videoIds = new Set([
    ...await Redis.Instance.listVideosForStats('views', hour),
    ...await Redis.Instance.listVideosForStats('downloads', hour)
  ])

  if (videoIds.size === 0) return

  logger.info(`Processing videos stats in job for hour ${hour}`)

  for (const videoId of videoIds) {
    try {
      const views = await Redis.Instance.getVideoStats('views', videoId, hour)
      const downloads = await Redis.Instance.getVideoStats('downloads', videoId, hour)

      await Redis.Instance.deleteVideoStats('views', videoId, hour)
      await Redis.Instance.deleteVideoStats('downloads', videoId, hour)

      if (!views && !downloads) continue

      logger.debug(
        `Adding ${views} views and ${downloads} downloads to video ${videoId} stats in hour ${hour}.`,
        views,
        downloads,
        videoId,
        hour
      )

      try {
        const video = await VideoModel.load(videoId)
        if (!video) {
          logger.debug(`Video ${videoId} does not exist anymore, skipping videos stats.`)
          continue
        }

        await VideoStatsModel.create({
          startDate: new Date(startDate),
          endDate: new Date(endDate),

          views,
          downloads,

          videoId
        })
      } catch (err) {
        logger.error('Cannot create video stats for video %d in hour %d.', videoId, hour, { err })
      }
    } catch (err) {
      logger.error('Cannot update video stats of video %d in hour %d.', videoId, hour, { err })
    }
  }
}
