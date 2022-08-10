
import { logger } from '@server/helpers/logger'
import { getAverageBitrate, getMinLimitBitrate } from '@shared/core-utils'
import { AvailableEncoders, EncoderOptionsBuilder, EncoderOptionsBuilderParams, VideoResolution } from '../../../shared/models/videos'
import {
  buildStreamSuffix,
  canDoQuickAudioTranscode,
  ffprobePromise,
  getAudioStream,
  getMaxAudioBitrate,
  resetSupportedEncoders
} from '../../helpers/ffmpeg'

/**
 *
 * Available encoders and profiles for the transcoding jobs
 * These functions are used by ffmpeg-utils that will get the encoders and options depending on the chosen profile
 *
 * Resources:
 *  * https://slhck.info/video/2017/03/01/rate-control.html
 *  * https://trac.ffmpeg.org/wiki/Limiting%20the%20output%20bitrate
 */

// ---------------------------------------------------------------------------
// Default builders
// ---------------------------------------------------------------------------

const defaultX264VODOptionsBuilder: EncoderOptionsBuilder = (options: EncoderOptionsBuilderParams) => {
  const { fps, inputRatio, inputBitrate, resolution } = options

  // TODO: remove in 4.2, fps is not optional anymore
  if (!fps) return { outputOptions: [ ] }

  const targetBitrate = getTargetBitrate({ inputBitrate, ratio: inputRatio, fps, resolution })

  return {
    outputOptions: [
      ...getCommonOutputOptions(targetBitrate),

      `-r ${fps}`
    ]
  }
}

const defaultX264LiveOptionsBuilder: EncoderOptionsBuilder = (options: EncoderOptionsBuilderParams) => {
  const { streamNum, fps, inputBitrate, inputRatio, resolution } = options

  const targetBitrate = getTargetBitrate({ inputBitrate, ratio: inputRatio, fps, resolution })

  return {
    outputOptions: [
      ...getCommonOutputOptions(targetBitrate, streamNum),

      `${buildStreamSuffix('-r:v', streamNum)} ${fps}`,
      `${buildStreamSuffix('-b:v', streamNum)} ${targetBitrate}`
    ]
  }
}

const defaultAACOptionsBuilder: EncoderOptionsBuilder = async ({ input, streamNum, canCopyAudio }) => {
  const probe = await ffprobePromise(input)

  if (canCopyAudio && await canDoQuickAudioTranscode(input, probe)) {
    logger.debug('Copy audio stream %s by AAC encoder.', input)
    return { copy: true, outputOptions: [ ] }
  }

  const parsedAudio = await getAudioStream(input, probe)

  // We try to reduce the ceiling bitrate by making rough matches of bitrates
  // Of course this is far from perfect, but it might save some space in the end

  const audioCodecName = parsedAudio.audioStream['codec_name']

  const bitrate = getMaxAudioBitrate(audioCodecName, parsedAudio.bitrate)

  logger.debug('Calculating audio bitrate of %s by AAC encoder.', input, { bitrate: parsedAudio.bitrate, audioCodecName })

  if (bitrate !== -1) {
    return { outputOptions: [ buildStreamSuffix('-b:a', streamNum), bitrate + 'k' ] }
  }

  return { outputOptions: [ ] }
}

const defaultLibFDKAACVODOptionsBuilder: EncoderOptionsBuilder = ({ streamNum }) => {
  return { outputOptions: [ buildStreamSuffix('-q:a', streamNum), '5' ] }
}

// ---------------------------------------------------------------------------
// Profile manager to get and change default profiles
// ---------------------------------------------------------------------------

class VideoTranscodingProfilesManager {
  private static instance: VideoTranscodingProfilesManager

  // 1 === less priority
  private readonly encodersPriorities = {
    vod: this.buildDefaultEncodersPriorities(),
    live: this.buildDefaultEncodersPriorities()
  }

  private readonly availableEncoders = {
    vod: {
      libx264: {
        default: defaultX264VODOptionsBuilder
      },
      aac: {
        default: defaultAACOptionsBuilder
      },
      libfdk_aac: {
        default: defaultLibFDKAACVODOptionsBuilder
      }
    },
    live: {
      libx264: {
        default: defaultX264LiveOptionsBuilder
      },
      aac: {
        default: defaultAACOptionsBuilder
      }
    }
  }

  private availableProfiles = {
    vod: [] as string[],
    live: [] as string[]
  }

  private constructor () {
    this.buildAvailableProfiles()
  }

  getAvailableEncoders (): AvailableEncoders {
    return {
      available: this.availableEncoders,
      encodersToTry: {
        vod: {
          video: this.getEncodersByPriority('vod', 'video'),
          audio: this.getEncodersByPriority('vod', 'audio')
        },
        live: {
          video: this.getEncodersByPriority('live', 'video'),
          audio: this.getEncodersByPriority('live', 'audio')
        }
      }
    }
  }

  getAvailableProfiles (type: 'vod' | 'live') {
    return this.availableProfiles[type]
  }

  addProfile (options: {
    type: 'vod' | 'live'
    encoder: string
    profile: string
    builder: EncoderOptionsBuilder
  }) {
    const { type, encoder, profile, builder } = options

    const encoders = this.availableEncoders[type]

    if (!encoders[encoder]) encoders[encoder] = {}
    encoders[encoder][profile] = builder

    this.buildAvailableProfiles()
  }

  removeProfile (options: {
    type: 'vod' | 'live'
    encoder: string
    profile: string
  }) {
    const { type, encoder, profile } = options

    delete this.availableEncoders[type][encoder][profile]
    this.buildAvailableProfiles()
  }

  addEncoderPriority (type: 'vod' | 'live', streamType: 'audio' | 'video', encoder: string, priority: number) {
    this.encodersPriorities[type][streamType].push({ name: encoder, priority })

    resetSupportedEncoders()
  }

  removeEncoderPriority (type: 'vod' | 'live', streamType: 'audio' | 'video', encoder: string, priority: number) {
    this.encodersPriorities[type][streamType] = this.encodersPriorities[type][streamType]
                                                    .filter(o => o.name !== encoder && o.priority !== priority)

    resetSupportedEncoders()
  }

  private getEncodersByPriority (type: 'vod' | 'live', streamType: 'audio' | 'video') {
    return this.encodersPriorities[type][streamType]
      .sort((e1, e2) => {
        if (e1.priority > e2.priority) return -1
        else if (e1.priority === e2.priority) return 0

        return 1
      })
      .map(e => e.name)
  }

  private buildAvailableProfiles () {
    for (const type of [ 'vod', 'live' ]) {
      const result = new Set()

      const encoders = this.availableEncoders[type]

      for (const encoderName of Object.keys(encoders)) {
        for (const profile of Object.keys(encoders[encoderName])) {
          result.add(profile)
        }
      }

      this.availableProfiles[type] = Array.from(result)
    }

    logger.debug('Available transcoding profiles built.', { availableProfiles: this.availableProfiles })
  }

  private buildDefaultEncodersPriorities () {
    return {
      video: [
        { name: 'libx264', priority: 100 }
      ],

      // Try the first one, if not available try the second one etc
      audio: [
        // we favor VBR, if a good AAC encoder is available
        { name: 'libfdk_aac', priority: 200 },
        { name: 'aac', priority: 100 }
      ]
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  VideoTranscodingProfilesManager
}

// ---------------------------------------------------------------------------

function getTargetBitrate (options: {
  inputBitrate: number
  resolution: VideoResolution
  ratio: number
  fps: number
}) {
  const { inputBitrate, resolution, ratio, fps } = options

  const capped = capBitrate(inputBitrate, getAverageBitrate({ resolution, fps, ratio }))
  const limit = getMinLimitBitrate({ resolution, fps, ratio })

  return Math.max(limit, capped)
}

function capBitrate (inputBitrate: number, targetBitrate: number) {
  if (!inputBitrate) return targetBitrate

  // Add 30% margin to input bitrate
  const inputBitrateWithMargin = inputBitrate + (inputBitrate * 0.3)

  return Math.min(targetBitrate, inputBitrateWithMargin)
}

function getCommonOutputOptions (targetBitrate: number, streamNum?: number) {
  return [
    `-preset veryfast`,
    `${buildStreamSuffix('-maxrate:v', streamNum)} ${targetBitrate}`,
    `${buildStreamSuffix('-bufsize:v', streamNum)} ${targetBitrate * 2}`,

    // NOTE: b-strategy 1 - heuristic algorithm, 16 is optimal B-frames for it
    `-b_strategy 1`,
    // NOTE: Why 16: https://github.com/Chocobozzz/PeerTube/pull/774. b-strategy 2 -> B-frames<16
    `-bf 16`
  ]
}
