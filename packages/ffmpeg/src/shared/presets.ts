import { pick } from '@peertube/peertube-core-utils'
import { FFmpegCommandWrapper } from '../ffmpeg-command-wrapper.js'
import { getScaleFilter, StreamType } from '../ffmpeg-utils.js'
import { ffprobePromise, getVideoStreamBitrate, getVideoStreamDimensionsInfo, hasAudioStream } from '../ffprobe.js'
import { addDefaultEncoderGlobalParams, addDefaultEncoderParams, applyEncoderOptions } from './encoder-options.js'

export async function presetVOD (options: {
  commandWrapper: FFmpegCommandWrapper

  input: string

  canCopyAudio: boolean
  canCopyVideo: boolean

  resolution: number
  fps: number

  scaleFilterValue?: string
}) {
  const { commandWrapper, input, resolution, fps, scaleFilterValue } = options
  const command = commandWrapper.getCommand()

  command.format('mp4')
    .outputOption('-movflags faststart')

  addDefaultEncoderGlobalParams(command)

  const probe = await ffprobePromise(input)

  // Audio encoder
  const bitrate = await getVideoStreamBitrate(input, probe)
  const videoStreamDimensions = await getVideoStreamDimensionsInfo(input, probe)

  let streamsToProcess: StreamType[] = [ 'audio', 'video' ]

  if (!await hasAudioStream(input, probe)) {
    command.noAudio()
    streamsToProcess = [ 'video' ]
  }

  for (const streamType of streamsToProcess) {
    const builderResult = await commandWrapper.getEncoderBuilderResult({
      ...pick(options, [ 'canCopyAudio', 'canCopyVideo' ]),

      input,
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

      if (scaleFilterValue) {
        command.outputOption(`-vf ${getScaleFilter(builderResult.result)}=${scaleFilterValue}`)
      }
    } else if (streamType === 'audio') {
      command.audioCodec(builderResult.encoder)
    }

    applyEncoderOptions(command, builderResult.result)
    addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps })
  }
}

export function presetCopy (commandWrapper: FFmpegCommandWrapper) {
  commandWrapper.getCommand()
    .format('mp4')
    .videoCodec('copy')
    .audioCodec('copy')
}

export function presetOnlyAudio (commandWrapper: FFmpegCommandWrapper) {
  commandWrapper.getCommand()
    .format('mp4')
    .audioCodec('copy')
    .noVideo()
}
