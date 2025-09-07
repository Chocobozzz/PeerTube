import { MVideo } from '@server/types/models/index.js'
import { STORYBOARD } from '@server/initializers/constants.js'

export function buildSpritesMetadata (options: {
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

export function buildSpritesMetadataFromDuration (options: {
  duration: number
}) {
  const { duration } = options

  if (duration < 3) return { spriteDuration: undefined, totalSprites: 0 }

  const maxSprites = Math.min(Math.ceil(duration), STORYBOARD.SPRITES_MAX_EDGE_COUNT * STORYBOARD.SPRITES_MAX_EDGE_COUNT)

  const spriteDuration = Math.ceil(duration / maxSprites)
  const totalSprites = Math.ceil(duration / spriteDuration)

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
