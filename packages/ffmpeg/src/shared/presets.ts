import { pick } from '@peertube/peertube-core-utils'
import { FilterSpecification } from 'fluent-ffmpeg'
import { FFmpegCommandWrapper } from '../ffmpeg-command-wrapper.js'
import { getScaleFilter, StreamType } from '../ffmpeg-utils.js'
import { ffprobePromise, getVideoStreamBitrate, getVideoStreamDimensionsInfo, hasAudioStream } from '../ffprobe.js'
import { addDefaultEncoderGlobalParams, addDefaultEncoderParams, applyEncoderOptions } from './encoder-options.js'

export async function presetVOD (options: {
  commandWrapper: FFmpegCommandWrapper

  videoInputPath: string
  separatedAudioInputPath?: string

  canCopyAudio: boolean
  canCopyVideo: boolean

  resolution: number
  fps: number

  videoStreamOnly: boolean

  chainComplexFilters: {
    complexFilters: FilterSpecification[]
    lastVideoInput: string
    videoOutput?: string
  } | null

  scaleFilterValue?: string
}) {
  const {
    commandWrapper,
    videoInputPath,
    separatedAudioInputPath,
    resolution,
    fps,
    videoStreamOnly,
    scaleFilterValue,
    chainComplexFilters
  } = options

  if (videoStreamOnly && !resolution) {
    throw new Error('Cannot generate video stream only without valid resolution')
  }

  const command = commandWrapper.getCommand()

  command.format('mp4')
    .outputOption('-movflags faststart')

  addDefaultEncoderGlobalParams(command)

  const videoProbe = await ffprobePromise(videoInputPath)
  const audioProbe = separatedAudioInputPath
    ? await ffprobePromise(separatedAudioInputPath)
    : videoProbe

  // Audio encoder
  const bitrate = await getVideoStreamBitrate(videoInputPath, videoProbe)
  const videoStreamDimensions = await getVideoStreamDimensionsInfo(videoInputPath, videoProbe)

  let streamsToProcess: StreamType[] = [ 'audio', 'video' ]

  if (videoStreamOnly || !await hasAudioStream(separatedAudioInputPath || videoInputPath, audioProbe)) {
    command.noAudio()
    streamsToProcess = [ 'video' ]
  } else if (!resolution) {
    command.noVideo()
    streamsToProcess = [ 'audio' ]
  }

  for (const streamType of streamsToProcess) {
    const input = streamType === 'video'
      ? videoInputPath
      : separatedAudioInputPath || videoInputPath

    const builderResult = await commandWrapper.getEncoderBuilderResult({
      ...pick(options, [ 'canCopyAudio', 'canCopyVideo' ]),

      input,
      inputProbe: streamType === 'video'
        ? videoProbe
        : audioProbe,

      inputBitrate: bitrate,
      inputRatio: videoStreamDimensions?.ratio || 0,

      resolution,
      fps,
      streamType,

      videoType: 'vod' as 'vod'
    })

    if (!builderResult) {
      throw new Error('No available encoder found for stream ' + streamType)
    }

    commandWrapper.debugLog(
      `Apply ffmpeg params from ${builderResult.encoder} for ${streamType} ` +
        `stream of input ${input} using ${commandWrapper.getProfile()} profile.`,
      { builderResult, resolution, fps }
    )

    if (streamType === 'video') {
      command.videoCodec(builderResult.encoder)

      const videoFilters: { name: string, rawOptions?: string }[] = []

      if (scaleFilterValue) {
        videoFilters.push({
          name: getScaleFilter(builderResult.result),
          rawOptions: scaleFilterValue
        })
      }

      for (const builderVideoFilter of builderResult.result.videoFilters || []) {
        videoFilters.push(builderVideoFilter)
      }

      applyVideoFilters({
        commandWrapper,
        videoFilters,
        chainComplexFilters
      })
    } else if (streamType === 'audio') {
      command.audioCodec(builderResult.encoder)
    }

    applyEncoderOptions(command, builderResult.result)
    addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps })
  }
}

export function presetCopy (commandWrapper: FFmpegCommandWrapper, options: {
  withAudio?: boolean // default true
  withVideo?: boolean // default true
} = {}) {
  const command = commandWrapper.getCommand()

  command.format('mp4')

  if (options.withAudio === false) command.noAudio()
  else command.audioCodec('copy')

  if (options.withVideo === false) command.noVideo()
  else command.videoCodec('copy')
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function applyVideoFilters (options: {
  commandWrapper: FFmpegCommandWrapper

  videoFilters: { name: string, rawOptions?: string }[]

  chainComplexFilters: {
    complexFilters: FilterSpecification[]
    lastVideoInput: string
    videoOutput?: string
  } | null
}) {
  const { commandWrapper, videoFilters, chainComplexFilters } = options

  const command = commandWrapper.getCommand()

  if (videoFilters.length === 0) return

  // We can't use `-vf` option if we have complex filters
  if (chainComplexFilters) {
    const complexFilters = [ ...chainComplexFilters.complexFilters ]

    for (let i = 0; i < videoFilters.length; i++) {
      const videoFilter = videoFilters[i]

      const outputName = i === videoFilters.length - 1
        ? chainComplexFilters.videoOutput
        : `vf_${i}`

      const inputName = i === 0
        ? chainComplexFilters.lastVideoInput
        : `vf_${i - 1}`

      complexFilters.push({
        filter: videoFilter.name,
        inputs: [ inputName ],

        outputs: outputName
          ? [ outputName ]
          : undefined,

        options: videoFilter.rawOptions
      })
    }

    command.complexFilter(complexFilters)
  } else {
    const filterString = videoFilters
      .map(f => {
        if (f.rawOptions) return `${f.name}=${f.rawOptions}`

        return f.name
      })
      .join(',')

    command.outputOption(`-vf ${filterString}`)
  }
}
