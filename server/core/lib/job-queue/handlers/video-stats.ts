import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { VideoStatModel } from '@server/models/stat/video-stat.js'
import { logger } from '../../../helpers/logger.js'
import { VideoModel } from '../../../models/video/video.js'
import { Redis } from '../../redis.js'

/**
 * Add number of stats grabbed in a time-range to the database, so we can calculate stats timeseries
 */

export async function processVideosStats () {
  const lastHour = new Date()

  // In test mode, we run this function multiple times per hour, so we don't want the values of the previous hour
  if (!isTestOrDevInstance()) lastHour.setHours(lastHour.getHours() - 1)

  const hour = lastHour.getHours()
  const startDate = lastHour.setMinutes(0, 0, 0)
  const endDate = lastHour.setMinutes(59, 59, 999)

  const videoIds = await Redis.Instance.listVideosForStats(hour)
  if (videoIds.length === 0) return

  logger.info(`Processing videos stats in job for hour ${hour}`)

  for (const videoId of videoIds) {
    try {
      const views = await Redis.Instance.getVideoStats('views', videoId, hour)
      const downloads = await Redis.Instance.getVideoStats('downloads', videoId, hour)

      await Redis.Instance.deleteVideoStats(videoId, hour)

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

        await VideoStatModel.create({
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
