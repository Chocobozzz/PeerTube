import { getAverageTheoreticalBitrate, getMaxTheoreticalBitrate, getMinTheoreticalBitrate } from '@peertube/peertube-core-utils'
import {
  buildStreamSuffix,
  getAudioStream,
  getMaxAudioBitrate,
  getVideoStream,
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS
} from '@peertube/peertube-ffmpeg'
import { EncoderOptionsBuilder, EncoderOptionsBuilderParams } from '@peertube/peertube-models'
import { FfprobeData } from 'fluent-ffmpeg'

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

const defaultAACOptionsBuilder: EncoderOptionsBuilder = async ({ input, streamNum, canCopyAudio, inputProbe }) => {
  if (canCopyAudio && await canDoQuickAudioTranscode(input, inputProbe)) {
    return { copy: true, outputOptions: [ ] }
  }

  const parsedAudio = await getAudioStream(input, inputProbe)

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

export function getDefaultAvailableEncoders () {
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

export function getDefaultEncodersToTry () {
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

export async function canDoQuickAudioTranscode (path: string, probe?: FfprobeData): Promise<boolean> {
  const parsedAudio = await getAudioStream(path, probe)

  if (!parsedAudio.audioStream) return true

  if (parsedAudio.audioStream['codec_name'] !== 'aac') return false

  const audioBitrate = parsedAudio.bitrate
  if (!audioBitrate) return false

  const maxAudioBitrate = getMaxAudioBitrate('aac', audioBitrate)
  if (maxAudioBitrate !== -1 && audioBitrate > maxAudioBitrate) return false

  const channelLayout = parsedAudio.audioStream['channel_layout']
  // Causes playback issues with Chrome
  if (!channelLayout || channelLayout === 'unknown' || channelLayout === 'quad') return false

  return true
}

export async function canDoQuickVideoTranscode (path: string, maxFPS: number, probe?: FfprobeData): Promise<boolean> {
  const videoStream = await getVideoStream(path, probe)
  const fps = await getVideoStreamFPS(path, probe)
  const bitRate = await getVideoStreamBitrate(path, probe)
  const resolutionData = await getVideoStreamDimensionsInfo(path, probe)

  // If ffprobe did not manage to guess the bitrate
  if (!bitRate) return false

  // check video params
  if (!videoStream) return false
  if (videoStream['codec_name'] !== 'h264') return false
  if (videoStream['pix_fmt'] !== 'yuv420p') return false
  if (fps < 2 || fps > maxFPS) return false
  if (bitRate > getMaxTheoreticalBitrate({ ...resolutionData, fps })) return false

  return true
}

// ---------------------------------------------------------------------------

function getTargetBitrate (options: {
  inputBitrate: number
  resolution: number
  ratio: number
  fps: number
}) {
  const { inputBitrate, resolution, ratio, fps } = options

  const capped = capBitrate(inputBitrate, getAverageTheoreticalBitrate({ resolution, fps, ratio }))
  const limit = getMinTheoreticalBitrate({ resolution, fps, ratio })

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
