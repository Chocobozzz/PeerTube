import { FFmpegImage, ffprobePromise, getVideoStreamDimensionsInfo } from '@peertube/peertube-ffmpeg'
import { GenerateStoryboardPayload, VideoFileStream } from '@peertube/peertube-models'
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
import { MVideo } from '@server/types/models/index.js'
import { Job } from 'bullmq'
import { join } from 'path'

const lTagsBase = loggerTagsFactory('storyboard')

async function processGenerateStoryboard (job: Job): Promise<void> {
  const payload = job.data as GenerateStoryboardPayload
  const lTags = lTagsBase(payload.videoUUID)

  logger.info('Processing generate storyboard of %s in job %s.', payload.videoUUID, job.id, lTags)

  const inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(payload.videoUUID)

  try {
    const video = await VideoModel.loadFull(payload.videoUUID)
    if (!video) {
      logger.info('Video %s does not exist anymore, skipping storyboard generation.', payload.videoUUID, lTags)
      return
    }

    const inputFile = video.getMaxQualityFile(VideoFileStream.VIDEO)
    if (!inputFile) {
      logger.info('Do not generate a storyboard of %s since the video does not have a video stream', payload.videoUUID, lTags)
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
        logger.info('Do not generate a storyboard of %s because the video is not long enough', payload.videoUUID, lTags)
        return
      }

      const spritesCount = findGridSize({
        toFind: totalSprites,
        maxEdgeCount: STORYBOARD.SPRITES_MAX_EDGE_COUNT
      })

      logger.debug(
        'Generating storyboard from video of %s to %s', video.uuid, destination,
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

      const imageSize = await getImageSizeFromWorker(destination)

      await retryTransactionWrapper(() => {
        return sequelizeTypescript.transaction(async transaction => {
          const videoStillExists = await VideoModel.load(video.id, transaction)
          if (!videoStillExists) {
            logger.info('Video %s does not exist anymore, skipping storyboard generation.', payload.videoUUID, lTags)
            deleteFileAndCatch(destination)
            return
          }

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

          logger.info('Storyboard generation %s ended for video %s.', destination, video.uuid, lTags)

          if (payload.federate) {
            await federateVideoIfNeeded(video, false, transaction)
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

function buildSpritesMetadata (options: {
  video: MVideo
}) {
  const { video } = options

  if (video.duration < 3) return { spriteDuration: undefined, totalSprites: 0 }

  const maxSprites = Math.min(Math.ceil(video.duration), STORYBOARD.SPRITES_MAX_EDGE_COUNT * STORYBOARD.SPRITES_MAX_EDGE_COUNT)

  const spriteDuration = Math.ceil(video.duration / maxSprites)
  const totalSprites = Math.ceil(video.duration / spriteDuration)

  // We can generate a single line so we don't need a prime number
  if (totalSprites <= STORYBOARD.SPRITES_MAX_EDGE_COUNT) return { spriteDuration, totalSprites }

  return { spriteDuration, totalSprites }
}

function findGridSize (options: {
  toFind: number
  maxEdgeCount: number
}) {
  const { toFind, maxEdgeCount } = options

  for (let i = 1; i <= maxEdgeCount; i++) {
    for (let j = i; j <= maxEdgeCount; j++) {
      if (toFind <= i * j) return { width: j, height: i }
    }
  }

  throw new Error(`Could not find grid size (to find: ${toFind}, max edge count: ${maxEdgeCount}`)
}
