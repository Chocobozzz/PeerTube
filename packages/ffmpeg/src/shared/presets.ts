import { pick } from '@peertube/peertube-core-utils'
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

  scaleFilterValue?: string
}) {
  const { commandWrapper, videoInputPath, separatedAudioInputPath, resolution, fps, videoStreamOnly, scaleFilterValue } = options

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
