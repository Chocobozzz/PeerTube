import { getAverageTheoreticalBitrate, getMaxTheoreticalBitrate, getMinTheoreticalBitrate } from '@peertube/peertube-core-utils'
import {
  buildStreamSuffix,
  ffprobePromise,
  getAudioStream,
  getCopyInfoOrMaxAudioKBitrate,
  getVideoStream,
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS,
  getVideoStreamStereo3D
} from '@peertube/peertube-ffmpeg'
import { EncoderOptionsBuilder, EncoderOptionsBuilderParams, VideoStereo3D } from '@peertube/peertube-models'
import { FfprobeData } from 'fluent-ffmpeg'

const defaultX264VODOptionsBuilder: EncoderOptionsBuilder = (options: EncoderOptionsBuilderParams) => {
  const { fps, inputRatio, inputBitrate, resolution, inputStereo3D } = options

  const targetBitrate = getTargetBitrate({ inputBitrate, ratio: inputRatio, fps, resolution })

  const videoFilters: { name: string, rawOptions?: string }[] = []
  const outputOptions = getCommonOutputOptions(targetBitrate)

  if (inputStereo3D) {
    /**
     * libx264 writes the 3D packing from the Stereo 3D side data of each frame, which ffmpeg >= 7 copies from the input stream.
     *
     * We can't rely on it:
     *  * libx264 ignores the packing when the right eye comes first
     *  * ffmpeg < 7 doesn't copy it
     *  * after a rotation it describes the frame before rotation.
     *
     * So we remove it from the frames and pass the packing to libx264 ourselves
     */

    const framePacking = getX264FramePacking(inputStereo3D)

    if (framePacking !== undefined && inputStereo3D.inverted) {
      videoFilters.push({
        name: 'stereo3d',
        rawOptions: framePacking === 3
          ? 'sbs2r:sbs2l'
          : 'ab2r:ab2l'
      })
    }

    videoFilters.push({ name: 'sidedata', rawOptions: 'mode=delete:type=STEREO3D' })

    if (framePacking !== undefined) outputOptions.push(`-x264-params frame-packing=${framePacking}`)
  }

  if (fps) videoFilters.push({ name: 'fps', rawOptions: `fps=${fps}` })

  return {
    videoFilters: videoFilters.length !== 0
      ? videoFilters
      : undefined,

    outputOptions
  }
}

const defaultX264LiveOptionsBuilder: EncoderOptionsBuilder = (options: EncoderOptionsBuilderParams) => {
  const { streamNum, fps, inputBitrate, inputRatio, resolution } = options

  const targetBitrate = getTargetBitrate({ inputBitrate, ratio: inputRatio, fps, resolution })

  return {
    videoFilters: fps
      ? [ { name: 'fps', rawOptions: `fps=${fps}` } ]
      : undefined,

    outputOptions: [
      ...getCommonOutputOptions(targetBitrate, streamNum),

      `${buildStreamSuffix('-b:v', streamNum)} ${targetBitrate}`
    ]
  }
}

const defaultAACOptionsBuilder: EncoderOptionsBuilder = async ({ input, streamNum, canCopyAudio, inputProbe }) => {
  if (canCopyAudio && await canDoQuickAudioTranscode(input, inputProbe)) {
    return { copy: true, outputOptions: [] }
  }

  const parsedAudio = await getAudioStream(input, inputProbe)

  // We try to reduce the ceiling bitrate by making rough matches of bitrates
  // Of course this is far from perfect, but it might save some space in the end

  const audioCodecName = parsedAudio.audioStream['codec_name']

  const bitrate = getCopyInfoOrMaxAudioKBitrate(audioCodecName, parsedAudio.bitrate)

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

  const canCopy = getCopyInfoOrMaxAudioKBitrate('aac', audioBitrate) === -1
  if (!canCopy) return false

  const channelLayout = parsedAudio.audioStream['channel_layout']
  // Causes playback issues with Chrome
  if (!channelLayout || channelLayout === 'unknown' || channelLayout === 'quad') return false

  return true
}

export async function canDoQuickVideoTranscode (
  path: string,
  maxFPS: number,
  existingProbe?: FfprobeData,
  options: {
    // Can be false if the encoder doesn't support stereo 3D
    reEncodeKeepsStereo3D?: boolean // default true
  } = {}
): Promise<boolean> {
  const { reEncodeKeepsStereo3D = true } = options

  const probe = existingProbe ?? await ffprobePromise(path)

  const videoStream = await getVideoStream(path, probe)
  if (!videoStream) return true

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
  // Force a re-encode when the input has a Display Matrix rotation to apply into the pixels
  if (resolutionData.hasRotation) return false
  // Force a re-encode when the container declares a 3D packing: the MP4 we write does not keep it, the frame packing SEI of libx264 does
  if (reEncodeKeepsStereo3D && getX264FramePacking(await getVideoStreamStereo3D(path, probe)) !== undefined) return false

  return true
}

// Copy codecs if the input file can be quick transcoded (appropriate bitrate, codecs, etc.)
// And if the input resolution/fps are the same as the output resolution/fps
export async function canCopyForHLS (options: {
  path: string
  fps: number
  resolution: number
  reEncodeKeepsStereo3D?: boolean // default true
}, probe?: FfprobeData): Promise<boolean> {
  const { path, fps, resolution, reEncodeKeepsStereo3D } = options

  const inputProbe = probe ?? await ffprobePromise(path)
  const { resolution: inputResolution } = await getVideoStreamDimensionsInfo(path, inputProbe)
  const inputFPS = await getVideoStreamFPS(path, inputProbe)

  return await canDoQuickAudioTranscode(path, inputProbe) &&
    await canDoQuickVideoTranscode(path, fps, inputProbe, { reEncodeKeepsStereo3D }) &&
    resolution === inputResolution &&
    (!inputResolution || fps === inputFPS)
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

function getX264FramePacking (stereo3D: VideoStereo3D) {
  if (stereo3D?.type === 'side by side') return 3
  if (stereo3D?.type === 'top and bottom') return 4

  // We only handle side by side and top and bottom: the other packings don't survive scaling or fps changes
  return undefined
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
