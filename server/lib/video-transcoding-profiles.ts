import { logger } from '@server/helpers/logger'
import { AvailableEncoders, EncoderOptionsBuilder, getTargetBitrate, VideoResolution } from '../../shared/models/videos'
import { buildStreamSuffix, resetSupportedEncoders } from '../helpers/ffmpeg-utils'
import {
  canDoQuickAudioTranscode,
  ffprobePromise,
  getAudioStream,
  getMaxAudioBitrate,
  getVideoFileBitrate,
  getVideoStreamFromFile
} from '../helpers/ffprobe-utils'
import { VIDEO_TRANSCODING_FPS } from '../initializers/constants'

/**
 *
 * Available encoders and profiles for the transcoding jobs
 * These functions are used by ffmpeg-utils that will get the encoders and options depending on the chosen profile
 *
 */

// Resources:
//  * https://slhck.info/video/2017/03/01/rate-control.html
//  * https://trac.ffmpeg.org/wiki/Limiting%20the%20output%20bitrate

const defaultX264VODOptionsBuilder: EncoderOptionsBuilder = async ({ input, resolution, fps }) => {
  const targetBitrate = await buildTargetBitrate({ input, resolution, fps })
  if (!targetBitrate) return { outputOptions: [ ] }

  return {
    outputOptions: [
      `-preset veryfast`,
      `-r ${fps}`,
      `-maxrate ${targetBitrate}`,
      `-bufsize ${targetBitrate * 2}`
    ]
  }
}

const defaultX264LiveOptionsBuilder: EncoderOptionsBuilder = async ({ resolution, fps, streamNum }) => {
  const targetBitrate = getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS)

  return {
    outputOptions: [
      `-preset veryfast`,
      `${buildStreamSuffix('-r:v', streamNum)} ${fps}`,
      `${buildStreamSuffix('-b:v', streamNum)} ${targetBitrate}`,
      `-maxrate ${targetBitrate}`,
      `-bufsize ${targetBitrate * 2}`
    ]
  }
}

const defaultAACOptionsBuilder: EncoderOptionsBuilder = async ({ input, streamNum }) => {
  const probe = await ffprobePromise(input)

  if (await canDoQuickAudioTranscode(input, probe)) {
    logger.debug('Copy audio stream %s by AAC encoder.', input)
    return { copy: true, outputOptions: [] }
  }

  const parsedAudio = await getAudioStream(input, probe)

  // We try to reduce the ceiling bitrate by making rough matches of bitrates
  // Of course this is far from perfect, but it might save some space in the end

  const audioCodecName = parsedAudio.audioStream['codec_name']

  const bitrate = getMaxAudioBitrate(audioCodecName, parsedAudio.bitrate)

  logger.debug('Calculating audio bitrate of %s by AAC encoder.', input, { bitrate: parsedAudio.bitrate, audioCodecName })

  if (bitrate !== undefined && bitrate !== -1) {
    return { outputOptions: [ buildStreamSuffix('-b:a', streamNum), bitrate + 'k' ] }
  }

  return { outputOptions: [ ] }
}

const defaultLibFDKAACVODOptionsBuilder: EncoderOptionsBuilder = ({ streamNum }) => {
  return { outputOptions: [ buildStreamSuffix('-q:a', streamNum), '5' ] }
}

// Used to get and update available encoders
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
async function buildTargetBitrate (options: {
  input: string
  resolution: VideoResolution
  fps: number
}) {
  const { input, resolution, fps } = options
  const probe = await ffprobePromise(input)

  const videoStream = await getVideoStreamFromFile(input, probe)
  if (!videoStream) return undefined

  const targetBitrate = getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS)

  // Don't transcode to an higher bitrate than the original file
  const fileBitrate = await getVideoFileBitrate(input, probe)
  return Math.min(targetBitrate, fileBitrate)
}
