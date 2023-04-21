import { getAverageBitrate, getMinLimitBitrate } from '@shared/core-utils'
import { buildStreamSuffix, ffprobePromise, getAudioStream, getMaxAudioBitrate } from '@shared/ffmpeg'
import { EncoderOptionsBuilder, EncoderOptionsBuilderParams, VideoResolution } from '@shared/models'

const defaultX264VODOptionsBuilder: EncoderOptionsBuilder = (options: EncoderOptionsBuilderParams) => {
  const { fps, inputRatio, inputBitrate, resolution } = options

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

  const parsedAudio = await getAudioStream(input, probe)

  // We try to reduce the ceiling bitrate by making rough matches of bitrates
  // Of course this is far from perfect, but it might save some space in the end

  const audioCodecName = parsedAudio.audioStream['codec_name']

  const bitrate = getMaxAudioBitrate(audioCodecName, parsedAudio.bitrate)

  // Force stereo as it causes some issues with HLS playback in Chrome
  const base = [ '-channel_layout', 'stereo' ]

  if (bitrate !== -1) {
    return { outputOptions: base.concat([ buildStreamSuffix('-b:a', streamNum), bitrate + 'k' ]) }
  }

  return { outputOptions: base }
}

const defaultLibFDKAACVODOptionsBuilder: EncoderOptionsBuilder = ({ streamNum }) => {
  return { outputOptions: [ buildStreamSuffix('-q:a', streamNum), '5' ] }
}

export function getAvailableEncoders () {
  return {
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
}

export function getEncodersToTry () {
  return {
    vod: {
      video: [ 'libx264' ],
      audio: [ 'libfdk_aac', 'aac' ]
    },

    live: {
      video: [ 'libx264' ],
      audio: [ 'libfdk_aac', 'aac' ]
    }
  }
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
