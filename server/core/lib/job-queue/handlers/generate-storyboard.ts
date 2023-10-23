import { Job } from 'bullmq'
import { join } from 'path'
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
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo } from '@server/types/models/index.js'
import { FFmpegImage, isAudioFile } from '@peertube/peertube-ffmpeg'
import { GenerateStoryboardPayload } from '@peertube/peertube-models'
import { getImageSizeFromWorker } from '@server/lib/worker/parent-process.js'

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

    const inputFile = video.getMaxQualityFile()

    await VideoPathManager.Instance.makeAvailableVideoFile(inputFile, async videoPath => {
      const isAudio = await isAudioFile(videoPath)

      if (isAudio) {
        logger.info('Do not generate a storyboard of %s since the video does not have a video stream', payload.videoUUID, lTags)
        return
      }

      const ffmpeg = new FFmpegImage(getFFmpegCommandWrapperOptions('thumbnail'))

      const filename = generateImageFilename()
      const destination = join(CONFIG.STORAGE.STORYBOARDS_DIR, filename)

      const totalSprites = buildTotalSprites(video)
      if (totalSprites === 0) {
        logger.info('Do not generate a storyboard of %s because the video is not long enough', payload.videoUUID, lTags)
        return
      }

      const spriteDuration = Math.round(video.duration / totalSprites)

      const spritesCount = findGridSize({
        toFind: totalSprites,
        maxEdgeCount: STORYBOARD.SPRITES_MAX_EDGE_COUNT
      })

      logger.debug(
        'Generating storyboard from video of %s to %s', video.uuid, destination,
        { ...lTags, spritesCount, spriteDuration, videoDuration: video.duration }
      )

      await ffmpeg.generateStoryboardFromVideo({
        destination,
        path: videoPath,
        sprites: {
          size: STORYBOARD.SPRITE_SIZE,
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
            spriteHeight: STORYBOARD.SPRITE_SIZE.height,
            spriteWidth: STORYBOARD.SPRITE_SIZE.width,
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

function buildTotalSprites (video: MVideo) {
  const maxSprites = STORYBOARD.SPRITE_SIZE.height * STORYBOARD.SPRITE_SIZE.width
  const totalSprites = Math.min(Math.ceil(video.duration), maxSprites)

  // We can generate a single line
  if (totalSprites <= STORYBOARD.SPRITES_MAX_EDGE_COUNT) return totalSprites

  return findGridFit(totalSprites, STORYBOARD.SPRITES_MAX_EDGE_COUNT)
}

function findGridSize (options: {
  toFind: number
  maxEdgeCount: number
}) {
  const { toFind, maxEdgeCount } = options

  for (let i = 1; i <= maxEdgeCount; i++) {
    for (let j = i; j <= maxEdgeCount; j++) {
      if (toFind === i * j) return { width: j, height: i }
    }
  }

  throw new Error(`Could not find grid size (to find: ${toFind}, max edge count: ${maxEdgeCount}`)
}

function findGridFit (value: number, maxMultiplier: number) {
  for (let i = value; i--; i > 0) {
    if (!isPrimeWithin(i, maxMultiplier)) return i
  }

  throw new Error('Could not find prime number below ' + value)
}

function isPrimeWithin (value: number, maxMultiplier: number) {
  if (value < 2) return false

  for (let i = 2, end = Math.min(Math.sqrt(value), maxMultiplier); i <= end; i++) {
    if (value % i === 0 && value / i <= maxMultiplier) return false
  }

  return true
}
