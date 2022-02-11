import { getAvailableEncoders } from 'fluent-ffmpeg'
import { pick } from '@shared/core-utils'
import { AvailableEncoders, EncoderOptionsBuilder, EncoderOptionsBuilderParams, EncoderProfile } from '@shared/models'
import { promisify0 } from '../core-utils'
import { logger, loggerTagsFactory } from '../logger'

const lTags = loggerTagsFactory('ffmpeg')

// Detect supported encoders by ffmpeg
let supportedEncoders: Map<string, boolean>
async function checkFFmpegEncoders (peertubeAvailableEncoders: AvailableEncoders): Promise<Map<string, boolean>> {
  if (supportedEncoders !== undefined) {
    return supportedEncoders
  }

  const getAvailableEncodersPromise = promisify0(getAvailableEncoders)
  const availableFFmpegEncoders = await getAvailableEncodersPromise()

  const searchEncoders = new Set<string>()
  for (const type of [ 'live', 'vod' ]) {
    for (const streamType of [ 'audio', 'video' ]) {
      for (const encoder of peertubeAvailableEncoders.encodersToTry[type][streamType]) {
        searchEncoders.add(encoder)
      }
    }
  }

  supportedEncoders = new Map<string, boolean>()

  for (const searchEncoder of searchEncoders) {
    supportedEncoders.set(searchEncoder, availableFFmpegEncoders[searchEncoder] !== undefined)
  }

  logger.info('Built supported ffmpeg encoders.', { supportedEncoders, searchEncoders, ...lTags() })

  return supportedEncoders
}

function resetSupportedEncoders () {
  supportedEncoders = undefined
}

// Run encoder builder depending on available encoders
// Try encoders by priority: if the encoder is available, run the chosen profile or fallback to the default one
// If the default one does not exist, check the next encoder
async function getEncoderBuilderResult (options: EncoderOptionsBuilderParams & {
  streamType: 'video' | 'audio'
  input: string

  availableEncoders: AvailableEncoders
  profile: string

  videoType: 'vod' | 'live'
}) {
  const { availableEncoders, profile, streamType, videoType } = options

  const encodersToTry = availableEncoders.encodersToTry[videoType][streamType]
  const encoders = availableEncoders.available[videoType]

  for (const encoder of encodersToTry) {
    if (!(await checkFFmpegEncoders(availableEncoders)).get(encoder)) {
      logger.debug('Encoder %s not available in ffmpeg, skipping.', encoder, lTags())
      continue
    }

    if (!encoders[encoder]) {
      logger.debug('Encoder %s not available in peertube encoders, skipping.', encoder, lTags())
      continue
    }

    // An object containing available profiles for this encoder
    const builderProfiles: EncoderProfile<EncoderOptionsBuilder> = encoders[encoder]
    let builder = builderProfiles[profile]

    if (!builder) {
      logger.debug('Profile %s for encoder %s not available. Fallback to default.', profile, encoder, lTags())
      builder = builderProfiles.default

      if (!builder) {
        logger.debug('Default profile for encoder %s not available. Try next available encoder.', encoder, lTags())
        continue
      }
    }

    const result = await builder(
      pick(options, [
        'input',
        'canCopyAudio',
        'canCopyVideo',
        'resolution',
        'inputBitrate',
        'fps',
        'inputRatio',
        'streamNum'
      ])
    )

    return {
      result,

      // If we don't have output options, then copy the input stream
      encoder: result.copy === true
        ? 'copy'
        : encoder
    }
  }

  return null
}

export {
  checkFFmpegEncoders,
  resetSupportedEncoders,

  getEncoderBuilderResult
}
