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

const availableEncoders: AvailableEncoders = {
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

// ---------------------------------------------------------------------------

export {
  availableEncoders
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
