import { ffprobePromise, getVideoStreamDimensionsInfo } from '@peertube/peertube-ffmpeg'
import { FileStorage } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { deleteFileAndCatch } from '@server/helpers/fs.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { STORYBOARD } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo } from '@server/types/models/index.js'
import { scheduleVideoFederation } from './activitypub/videos/federate.js'
import { removeCommonFileObjectStorage, storeCommonFile } from './object-storage/common-files.js'

const logger = createLogger()

export async function buildSpriteSize (videoPath: string) {
  const probe = await ffprobePromise(videoPath)
  const videoStreamInfo = await getVideoStreamDimensionsInfo(videoPath, probe)

  if (videoStreamInfo.isPortraitMode) {
    return {
      spriteHeight: STORYBOARD.SPRITE_MAX_SIZE,
      spriteWidth: Math.round(STORYBOARD.SPRITE_MAX_SIZE * videoStreamInfo.ratio)
    }
  }

  return {
    spriteWidth: STORYBOARD.SPRITE_MAX_SIZE,
    spriteHeight: Math.round(STORYBOARD.SPRITE_MAX_SIZE / videoStreamInfo.ratio)
  }
}

export function buildTotalSprites (video: MVideo) {
  if (video.duration < 3) return { spriteDuration: undefined, totalSprites: 0 }

  const maxSprites = Math.min(Math.ceil(video.duration), STORYBOARD.SPRITES_MAX_EDGE_COUNT * STORYBOARD.SPRITES_MAX_EDGE_COUNT)

  const spriteDuration = Math.ceil(video.duration / maxSprites)
  const totalSprites = Math.ceil(video.duration / spriteDuration)

  return { spriteDuration, totalSprites }
}

export function findGridSize (options: {
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

export async function insertStoryboardInDatabase (options: {
  videoUUID: string
  filename: string
  destination: string
  imageSize: { width: number, height: number }
  spriteHeight: number
  spriteWidth: number
  spriteDuration: number
  federate: boolean
}) {
  const { videoUUID, imageSize, spriteHeight, spriteWidth, spriteDuration, destination, filename, federate } = options

  const onObjectStorage = CONFIG.OBJECT_STORAGE.STORYBOARDS.ENABLED

  const storage = onObjectStorage
    ? FileStorage.OBJECT_STORAGE
    : FileStorage.FILE_SYSTEM

  let uploaded = false
  let inserted = false

  try {
    // Upload before opening the transaction: retryTransactionWrapper must not re-upload
    if (onObjectStorage) {
      await storeCommonFile('storyboards', destination, filename)
      uploaded = true
    }

    inserted = await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        const video = await VideoModel.loadFull(videoUUID, transaction)
        if (!video) {
          logger.info(`Video ${videoUUID} does not exist anymore, skipping storyboard generation.`)
          return false
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
          videoId: video.id,
          cached: false,
          storage
        }, { transaction })

        if (federate) {
          scheduleVideoFederation({ video, transaction })
        }

        return true
      })
    })
  } finally {
    // The tmp file is useless once uploaded
    if (onObjectStorage || !inserted) deleteFileAndCatch(destination)

    if (uploaded && !inserted) {
      removeCommonFileObjectStorage('storyboards', filename)
        .catch(err => logger.error(`Cannot remove orphan storyboard ${filename} from object storage`, { err }))
    }
  }
}
