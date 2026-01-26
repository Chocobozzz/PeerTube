import { FFmpegImage } from '@peertube/peertube-ffmpeg'
import { GenerateStoryboardPayload, VideoFileStream } from '@peertube/peertube-models'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/index.js'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { STORYBOARD } from '@server/initializers/constants.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { getImageSizeFromWorker } from '@server/lib/worker/parent-process.js'
import { VideoModel } from '@server/models/video/video.js'
import { Job } from 'bullmq'
import { join } from 'path'
import { buildSpriteSize, buildTotalSprites, findGridSize, insertStoryboardInDatabase } from '../../storyboard.js'

const lTagsBase = loggerTagsFactory('storyboard')

export async function processGenerateStoryboard (job: Job): Promise<void> {
  const payload = job.data as GenerateStoryboardPayload
  const lTags = lTagsBase(payload.videoUUID)

  logger.info(`Processing generate storyboard of ${payload.videoUUID} in job ${job.id}.`, lTags)

  if (CONFIG.STORYBOARDS.ENABLED !== true) {
    logger.info(`Storyboard disabled, do not process storyboard of ${payload.videoUUID} in job ${job.id}.`, lTags)
    return
  }

  const inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(payload.videoUUID)

  try {
    const video = await VideoModel.loadFull(payload.videoUUID)
    if (!video) {
      logger.info(`Video ${payload.videoUUID} does not exist anymore, skipping storyboard generation.`, lTags)
      return
    }

    const inputFile = video.getMaxQualityFile(VideoFileStream.VIDEO)
    if (!inputFile) {
      logger.info(`Do not generate a storyboard of ${payload.videoUUID} since the video does not have a video stream`, lTags)
      return
    }

    await VideoPathManager.Instance.makeAvailableVideoFile(inputFile, async videoPath => {
      const { spriteHeight, spriteWidth } = await buildSpriteSize(videoPath)

      const { totalSprites, spriteDuration } = buildTotalSprites(video)
      if (totalSprites === 0) {
        logger.info(`Do not generate a storyboard of ${payload.videoUUID} because the video is not long enough`, lTags)
        return
      }

      const spritesCount = findGridSize({
        toFind: totalSprites,
        maxEdgeCount: STORYBOARD.SPRITES_MAX_EDGE_COUNT
      })

      const filename = generateImageFilename()
      const destination = join(CONFIG.STORAGE.STORYBOARDS_DIR, filename)

      logger.debug(
        `Generating storyboard from video of ${video.uuid} to ${destination}`,
        { ...lTags, totalSprites, spritesCount, spriteDuration, videoDuration: video.duration, spriteHeight, spriteWidth }
      )

      const ffmpeg = new FFmpegImage(getFFmpegCommandWrapperOptions('thumbnail'))

      await ffmpeg.generateStoryboardFromVideo({
        destination,
        path: videoPath,
        inputFileMutexReleaser,
        sprites: {
          size: {
            height: spriteHeight,
            width: spriteWidth
          },
          count: spritesCount,
          duration: spriteDuration
        }
      })

      await insertStoryboardInDatabase({
        videoUUID: video.uuid,
        lTags,

        filename,
        destination,

        imageSize: await getImageSizeFromWorker(destination),

        spriteHeight,
        spriteWidth,
        spriteDuration,

        federate: payload.federate
      })
    })
  } finally {
    inputFileMutexReleaser()
  }
}
