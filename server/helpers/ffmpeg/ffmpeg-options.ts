import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { FFMPEG_NICE } from '@server/initializers/constants'
import { FFmpegCommandWrapperOptions } from '@shared/ffmpeg'
import { AvailableEncoders } from '@shared/models'

type CommandType = 'live' | 'vod' | 'thumbnail'

export function getFFmpegCommandWrapperOptions (type: CommandType, availableEncoders?: AvailableEncoders): FFmpegCommandWrapperOptions {
  return {
    availableEncoders,
    profile: getProfile(type),

    niceness: FFMPEG_NICE[type.toUpperCase()],
    tmpDirectory: CONFIG.STORAGE.TMP_DIR,
    threads: getThreads(type),

    logger: {
      debug: logger.debug.bind(logger),
      info: logger.info.bind(logger),
      warn: logger.warn.bind(logger),
      error: logger.error.bind(logger)
    },
    lTags: { tags: [ 'ffmpeg' ] }
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getThreads (type: CommandType) {
  if (type === 'live') return CONFIG.LIVE.TRANSCODING.THREADS
  if (type === 'vod') return CONFIG.TRANSCODING.THREADS

  // Auto
  return 0
}

function getProfile (type: CommandType) {
  if (type === 'live') return CONFIG.LIVE.TRANSCODING.PROFILE
  if (type === 'vod') return CONFIG.TRANSCODING.PROFILE

  return undefined
}
