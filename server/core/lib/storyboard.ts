import { ffprobePromise, getVideoStreamDimensionsInfo } from '@peertube/peertube-ffmpeg'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { LoggerTags, logger } from '@server/helpers/logger.js'
import { deleteFileAndCatch } from '@server/helpers/utils.js'
import { STORYBOARD } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo } from '@server/types/models/index.js'
import { federateVideoIfNeeded } from './activitypub/videos/federate.js'

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

  // We can generate a single line so we don't need a prime number
  if (totalSprites <= STORYBOARD.SPRITES_MAX_EDGE_COUNT) return { spriteDuration, totalSprites }

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
  lTags: LoggerTags
  filename: string
  destination: string
  imageSize: { width: number, height: number }
  spriteHeight: number
  spriteWidth: number
  spriteDuration: number
  federate: boolean
}) {
  const { videoUUID, lTags, imageSize, spriteHeight, spriteWidth, spriteDuration, destination, filename, federate } = options

  await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      const video = await VideoModel.loadFull(videoUUID, transaction)
      if (!video) {
        logger.info(`Video ${videoUUID} does not exist anymore, skipping storyboard generation.`, lTags)
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

      if (federate) {
        await federateVideoIfNeeded(video, false, transaction)
      }
    })
  })
}
