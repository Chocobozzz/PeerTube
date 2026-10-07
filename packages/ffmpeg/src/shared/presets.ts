import { pick } from '@peertube/peertube-core-utils'
import { FilterSpecification } from 'fluent-ffmpeg'
import { FFmpegCommandWrapper } from '../ffmpeg-command-wrapper.js'
import { getScaleFilter, StreamType } from '../ffmpeg-utils.js'
import {
  ffprobePromise,
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  getVideoStreamStereo3D,
  hasAudioStream
} from '../ffprobe.js'
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

      videoType: 'vod'
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

      // libx264 writes the frame packing SEI from the 3D packing of the input, but not when the right eye comes first:
      // put the left eye first and say the packing to libx264
      const stereo3D = builderResult.encoder === 'libx264'
        ? await getVideoStreamStereo3D(videoInputPath, videoProbe)
        : undefined

      if (stereo3D?.inverted && (stereo3D.type === 'side by side' || stereo3D.type === 'top and bottom')) {
        const isSideBySide = stereo3D.type === 'side by side'

        videoFilters.push({ name: 'stereo3d', rawOptions: isSideBySide ? 'sbs2r:sbs2l' : 'ab2r:ab2l' })
        // The frames keep the (inverted) side data of the input, and libx264 would drop the packing again because of it
        videoFilters.push({ name: 'sidedata', rawOptions: 'mode=delete:type=STEREO3D' })
        command.outputOption(`-x264-params frame-packing=${isSideBySide ? 3 : 4}`)
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

  // We can't use `-vf` option if we have complex filters
  if (chainComplexFilters) {
    const { lastVideoInput, videoOutput } = chainComplexFilters
    const complexFilters = [ ...chainComplexFilters.complexFilters ]

    for (let i = 0; i < videoFilters.length; i++) {
      const videoFilter = videoFilters[i]

      const outputName = i === videoFilters.length - 1
        ? videoOutput
        : `vf_${i}`

      const inputName = i === 0
        ? lastVideoInput
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

    // No video filter was chained onto the last complex filter output (can happen with concat or overlay)
    // Alias it through a no-op filter so a `videoOutput` label can still be mapped
    if (videoFilters.length === 0) {
      complexFilters.push({
        filter: 'null',
        inputs: [ lastVideoInput ],
        outputs: videoOutput
          ? [ videoOutput ]
          : undefined
      })
    }

    command.complexFilter(complexFilters)
  } else if (videoFilters.length !== 0) {
    const filterString = videoFilters
      .map(f => {
        if (f.rawOptions) return `${f.name}=${f.rawOptions}`

        return f.name
      })
      .join(',')

    command.outputOption(`-vf ${filterString}`)
  }
}
