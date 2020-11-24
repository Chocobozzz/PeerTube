import { getTargetBitrate } from '../../shared/models/videos'
import { AvailableEncoders, buildStreamSuffix, EncoderOptionsBuilder } from '../helpers/ffmpeg-utils'
import { ffprobePromise, getAudioStream, getMaxAudioBitrate, getVideoFileBitrate, getVideoStreamFromFile } from '../helpers/ffprobe-utils'
import { VIDEO_TRANSCODING_FPS } from '../initializers/constants'

// ---------------------------------------------------------------------------
// Available encoders profiles
// ---------------------------------------------------------------------------

// Resources:
//  * https://slhck.info/video/2017/03/01/rate-control.html
//  * https://trac.ffmpeg.org/wiki/Limiting%20the%20output%20bitrate

const defaultX264VODOptionsBuilder: EncoderOptionsBuilder = async ({ input, resolution, fps }) => {
  let targetBitrate = getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS)

  const probe = await ffprobePromise(input)

  const videoStream = await getVideoStreamFromFile(input, probe)
  if (!videoStream) {
    return { outputOptions: [ ] }
  }

  // Don't transcode to an higher bitrate than the original file
  const fileBitrate = await getVideoFileBitrate(input, probe)
  targetBitrate = Math.min(targetBitrate, fileBitrate)

  return {
    outputOptions: [
      `-maxrate ${targetBitrate}`, `-bufsize ${targetBitrate * 2}`
    ]
  }
}

const defaultX264LiveOptionsBuilder: EncoderOptionsBuilder = async ({ resolution, fps, streamNum }) => {
  const targetBitrate = getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS)

  return {
    outputOptions: [
      `${buildStreamSuffix('-b:v', streamNum)} ${targetBitrate}`,
      `-maxrate ${targetBitrate}`,
      `-bufsize ${targetBitrate * 2}`
    ]
  }
}

const defaultAACOptionsBuilder: EncoderOptionsBuilder = async ({ input, streamNum }) => {
  const parsedAudio = await getAudioStream(input)

  // We try to reduce the ceiling bitrate by making rough matches of bitrates
  // Of course this is far from perfect, but it might save some space in the end

  const audioCodecName = parsedAudio.audioStream['codec_name']

  const bitrate = getMaxAudioBitrate(audioCodecName, parsedAudio.bitrate)

  if (bitrate !== undefined && bitrate !== -1) {
    return { outputOptions: [ buildStreamSuffix('-b:a', streamNum), bitrate + 'k' ] }
  }

  return { copy: true, outputOptions: [] }
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
