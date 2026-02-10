import { logger, loggerTagsFactory } from "@server/helpers/logger.js"
import { generateRandomString } from "@server/helpers/utils.js"
import { Redis } from "@server/lib/redis.js"
import { VideoDownloadModel } from "@server/models/download/video-download.js"
import { VideoModel } from "@server/models/video/video.js"
import { MVideoThumbnail } from "@server/types/models/index.js"

const lTags = loggerTagsFactory("downloads")

const REDIS_SCOPE = "download"

type DownloadStats = {
  videoId: number;
  downloadedAt: number; // Date.getTime()
}

export class VideoDownloadStats {
  /**
   * Record a video download into Redis
   */
  static async add({ video }: { video: MVideoThumbnail }) {
    const sessionId = await generateRandomString(32)
    const videoId = video.id

    const stats: DownloadStats = {
      videoId,
      downloadedAt: new Date().getTime(),
    }

    try {
      await Redis.Instance.setStats(REDIS_SCOPE, sessionId, videoId, stats)
    } catch (err) {
      logger.error("Cannot write download into redis", {
        sessionId,
        videoId,
        stats,
        err,
      })
    }
  }

  /**
   * Aggregate video downloads from Redis into SQL database
   */
  static async save() {
    logger.debug("Saving download stats to DB", lTags())

    const keys = await Redis.Instance.getStatsKeys(REDIS_SCOPE)
    if (keys.length === 0) return

    logger.debug("Processing %d video download(s)", keys.length)

    for (const key of keys) {
      const stats: DownloadStats = await Redis.Instance.getStats({ key })

      const videoId = stats.videoId
      const video = await VideoModel.load(videoId)
      if (!video) {
        logger.debug(
          "Video %d does not exist anymore, skipping videos view stats.",
          videoId,
        )
        try {
          await Redis.Instance.deleteStatsKey(REDIS_SCOPE, key)
        } catch (err) {
          logger.error("Cannot remove key %s from Redis", key)
        }
        continue
      }

      const downloadedAt = new Date(stats.downloadedAt)
      const startDate = new Date(downloadedAt.setMinutes(0, 0, 0))
      const endDate = new Date(downloadedAt.setMinutes(59, 59, 999))

      logger.info(
        "date range: %s -> %s",
        startDate.toISOString(),
        endDate.toISOString(),
      )

      try {
        const record = await VideoDownloadModel.findOne({
          where: { videoId, startDate },
        })
        if (record) {
          // Increment download count for current time slice
          record.downloads++
          await record.save()
        } else {
          // Create a new time slice for this video downloads
          await VideoDownloadModel.create({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            downloads: 1,
            videoId,
          })
        }

        // Increment video total download count
        video.downloads++
        await video.save()

        await Redis.Instance.deleteStatsKey(REDIS_SCOPE, key)
      } catch (err) {
        logger.error(
          "Cannot update video views stats of video %d on range %s -> %s",
          videoId,
          startDate.toISOString(),
          endDate.toISOString(), { err },
        )
      }
    }
  }
}
