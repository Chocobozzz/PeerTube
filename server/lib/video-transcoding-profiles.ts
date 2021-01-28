import { logger } from '@server/helpers/logger'
import { getTargetBitrate, VideoResolution } from '../../shared/models/videos'
import { AvailableEncoders, buildStreamSuffix, EncoderOptionsBuilder } from '../helpers/ffmpeg-utils'
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

  private constructor () {

  }

  getAvailableEncoders (): AvailableEncoders {
    const encodersToTry = {
      video: this.getEncodersByPriority('video'),
      audio: this.getEncodersByPriority('audio')
    }

    return Object.assign({}, this.availableEncoders, { encodersToTry })
  }

  getAvailableProfiles (type: 'vod' | 'live') {
    return this.availableEncoders[type]
  }

  private getEncodersByPriority (type: 'video' | 'audio') {
    return this.encodersPriorities[type]
      .sort((e1, e2) => {
        if (e1.priority > e2.priority) return -1
        else if (e1.priority === e2.priority) return 0

        return 1
      })
      .map(e => e.name)
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
