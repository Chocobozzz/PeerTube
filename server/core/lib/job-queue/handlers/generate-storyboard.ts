import { FFmpegImage, ffprobePromise, getVideoStreamDimensionsInfo } from '@peertube/peertube-ffmpeg'
import { GenerateStoryboardPayload, VideoFileStream } from '@peertube/peertube-models'
import { getTranscodingJobPriority } from '@server/lib/transcoding/transcoding-priority.js'
import { VideoStoryboardJobHandler } from '@server/lib/runners/index.js'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/index.js'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { deleteFileAndCatch } from '@server/helpers/utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { STORYBOARD } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { getImageSizeFromWorker } from '@server/lib/worker/parent-process.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoModel } from '@server/models/video/video.js'
import { Job } from 'bullmq'
import { join } from 'path'
import { buildSpritesMetadata, findGridSize } from './shared/storyboard-utils.js'

const lTagsBase = loggerTagsFactory('storyboard')

async function processGenerateStoryboard (job: Job): Promise<void> {
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
      const probe = await ffprobePromise(videoPath)

      const videoStreamInfo = await getVideoStreamDimensionsInfo(videoPath, probe)
      let spriteHeight: number
      let spriteWidth: number

      if (videoStreamInfo.isPortraitMode) {
        spriteHeight = STORYBOARD.SPRITE_MAX_SIZE
        spriteWidth = Math.round(spriteHeight * videoStreamInfo.ratio)
      } else {
        spriteWidth = STORYBOARD.SPRITE_MAX_SIZE
        spriteHeight = Math.round(spriteWidth / videoStreamInfo.ratio)
      }

      const ffmpeg = new FFmpegImage(getFFmpegCommandWrapperOptions('thumbnail'))

      const filename = generateImageFilename()
      const destination = join(CONFIG.STORAGE.STORYBOARDS_DIR, filename)

      const { totalSprites, spriteDuration } = buildSpritesMetadata({ video })
      if (totalSprites === 0) {
        logger.info(`Do not generate a storyboard of ${payload.videoUUID} because the video is not long enough`, lTags)
        return
      }

      const spritesCount = findGridSize({
        toFind: totalSprites,
        maxEdgeCount: STORYBOARD.SPRITES_MAX_EDGE_COUNT
      })

      const runOnRunner = CONFIG.TRANSCODING.REMOTE_RUNNERS.ENABLED === true && CONFIG.STORYBOARDS.REMOTE_RUNNERS.ENABLED === true

      if (runOnRunner) {
        logger.debug(
          `Generating storyboard job for remote runners for video ${video.uuid}`,
          { ...lTags, totalSprites, spritesCount, spriteDuration, videoDuration: video.duration, spriteHeight, spriteWidth }
        )
        const priority = await getTranscodingJobPriority({ user: null, type: 'vod', fallback: 0 })
        await new VideoStoryboardJobHandler().create({ videoUUID: video.uuid, priority, federateAfter: payload.federate })
        return
      } else {
        logger.debug(
          `Generating storyboard from video of ${video.uuid} to ${destination}`,
          { ...lTags, totalSprites, spritesCount, spriteDuration, videoDuration: video.duration, spriteHeight, spriteWidth }
        )
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
      }

      const imageSize = await getImageSizeFromWorker(destination)

      await retryTransactionWrapper(() => {
        return sequelizeTypescript.transaction(async transaction => {
          const videoStillExists = await VideoModel.load(video.id, transaction)
          if (!videoStillExists) {
            logger.info(`Video ${payload.videoUUID} does not exist anymore, skipping storyboard generation.`, lTags)
            deleteFileAndCatch(destination)
            return
          }

          if (runOnRunner !== true) {
            const existing = await StoryboardModel.loadByVideo(video.id, transaction)
            if (existing) await existing.destroy({ transaction })

            await StoryboardModel.create({
              filename,
              totalHeight: imageSize.height,
              totalWidth: imageSize.width,
              spriteHeight,
              spriteWidth,
              spriteDuration,
              videoId: video.id
            }, { transaction })

            logger.info(`Storyboard generation ${destination} ended for video ${video.uuid}.`, lTags)

            if (payload.federate) {
              await federateVideoIfNeeded(video, false, transaction)
            }
          }
        })
      })
    })
  } finally {
    inputFileMutexReleaser()
  }
}

// ---------------------------------------------------------------------------

export {
  processGenerateStoryboard
}

