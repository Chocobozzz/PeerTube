import { FfmpegCommand } from 'fluent-ffmpeg'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { pick } from '@shared/core-utils'
import { AvailableEncoders, EncoderOptions } from '@shared/models'
import { buildStreamSuffix, getScaleFilter, StreamType } from './ffmpeg-commons'
import { getEncoderBuilderResult } from './ffmpeg-encoders'
import { ffprobePromise, getVideoStreamBitrate, getVideoStreamDimensionsInfo, hasAudioStream } from './ffprobe-utils'

const lTags = loggerTagsFactory('ffmpeg')

// ---------------------------------------------------------------------------

function addDefaultEncoderGlobalParams (command: FfmpegCommand) {
  // avoid issues when transcoding some files: https://trac.ffmpeg.org/ticket/6375
  command.outputOption('-max_muxing_queue_size 1024')
         // strip all metadata
         .outputOption('-map_metadata -1')
         // allows import of source material with incompatible pixel formats (e.g. MJPEG video)
         .outputOption('-pix_fmt yuv420p')
}

function addDefaultEncoderParams (options: {
  command: FfmpegCommand
  encoder: 'libx264' | string
  fps: number

  streamNum?: number
}) {
  const { command, encoder, fps, streamNum } = options

  if (encoder === 'libx264') {
    // 3.1 is the minimal resource allocation for our highest supported resolution
    command.outputOption(buildStreamSuffix('-level:v', streamNum) + ' 3.1')

    if (fps) {
      // Keyframe interval of 2 seconds for faster seeking and resolution switching.
      // https://streaminglearningcenter.com/blogs/whats-the-right-keyframe-interval.html
      // https://superuser.com/a/908325
      command.outputOption(buildStreamSuffix('-g:v', streamNum) + ' ' + (fps * 2))
    }
  }
}

// ---------------------------------------------------------------------------

async function presetVOD (options: {
  command: FfmpegCommand
  input: string

  availableEncoders: AvailableEncoders
  profile: string

  canCopyAudio: boolean
  canCopyVideo: boolean

  resolution: number
  fps: number

  scaleFilterValue?: string
}) {
  const { command, input, profile, resolution, fps, scaleFilterValue } = options

  let localCommand = command
    .format('mp4')
    .outputOption('-movflags faststart')

  addDefaultEncoderGlobalParams(command)

  const probe = await ffprobePromise(input)

  // Audio encoder
  const bitrate = await getVideoStreamBitrate(input, probe)
  const videoStreamDimensions = await getVideoStreamDimensionsInfo(input, probe)

  let streamsToProcess: StreamType[] = [ 'audio', 'video' ]

  if (!await hasAudioStream(input, probe)) {
    localCommand = localCommand.noAudio()
    streamsToProcess = [ 'video' ]
  }

  for (const streamType of streamsToProcess) {
    const builderResult = await getEncoderBuilderResult({
      ...pick(options, [ 'availableEncoders', 'canCopyAudio', 'canCopyVideo' ]),

      input,
      inputBitrate: bitrate,
      inputRatio: videoStreamDimensions?.ratio || 0,

      profile,
      resolution,
      fps,
      streamType,

      videoType: 'vod' as 'vod'
    })

    if (!builderResult) {
      throw new Error('No available encoder found for stream ' + streamType)
    }

    logger.debug(
      'Apply ffmpeg params from %s for %s stream of input %s using %s profile.',
      builderResult.encoder, streamType, input, profile,
      { builderResult, resolution, fps, ...lTags() }
    )

    if (streamType === 'video') {
      localCommand.videoCodec(builderResult.encoder)

      if (scaleFilterValue) {
        localCommand.outputOption(`-vf ${getScaleFilter(builderResult.result)}=${scaleFilterValue}`)
      }
    } else if (streamType === 'audio') {
      localCommand.audioCodec(builderResult.encoder)
    }

    applyEncoderOptions(localCommand, builderResult.result)
    addDefaultEncoderParams({ command: localCommand, encoder: builderResult.encoder, fps })
  }

  return localCommand
}

function presetCopy (command: FfmpegCommand): FfmpegCommand {
  return command
    .format('mp4')
    .videoCodec('copy')
    .audioCodec('copy')
}

function presetOnlyAudio (command: FfmpegCommand): FfmpegCommand {
  return command
    .format('mp4')
    .audioCodec('copy')
    .noVideo()
}

function applyEncoderOptions (command: FfmpegCommand, options: EncoderOptions): FfmpegCommand {
  return command
    .inputOptions(options.inputOptions ?? [])
    .outputOptions(options.outputOptions ?? [])
}

// ---------------------------------------------------------------------------

export {
  presetVOD,
  presetCopy,
  presetOnlyAudio,

  addDefaultEncoderGlobalParams,
  addDefaultEncoderParams,

  applyEncoderOptions
}
