import { FfmpegCommand, FilterSpecification } from 'fluent-ffmpeg'
import { join } from 'path'
import { VIDEO_LIVE } from '@server/initializers/constants'
import { AvailableEncoders, LiveVideoLatencyMode } from '@shared/models'
import { logger, loggerTagsFactory } from '../logger'
import { buildStreamSuffix, getFFmpeg, getScaleFilter, StreamType } from './ffmpeg-commons'
import { getEncoderBuilderResult } from './ffmpeg-encoders'
import { addDefaultEncoderGlobalParams, addDefaultEncoderParams, applyEncoderOptions } from './ffmpeg-presets'
import { computeFPS } from './ffprobe-utils'

const lTags = loggerTagsFactory('ffmpeg')

async function getLiveTranscodingCommand (options: {
  inputUrl: string

  outPath: string
  masterPlaylistName: string
  latencyMode: LiveVideoLatencyMode

  resolutions: number[]

  // Input information
  fps: number
  bitrate: number
  ratio: number
  hasAudio: boolean

  availableEncoders: AvailableEncoders
  profile: string
}) {
  const {
    inputUrl,
    outPath,
    resolutions,
    fps,
    bitrate,
    availableEncoders,
    profile,
    masterPlaylistName,
    ratio,
    latencyMode,
    hasAudio
  } = options

  const command = getFFmpeg(inputUrl, 'live')

  const varStreamMap: string[] = []

  const complexFilter: FilterSpecification[] = [
    {
      inputs: '[v:0]',
      filter: 'split',
      options: resolutions.length,
      outputs: resolutions.map(r => `vtemp${r}`)
    }
  ]

  command.outputOption('-sc_threshold 0')

  addDefaultEncoderGlobalParams(command)

  for (let i = 0; i < resolutions.length; i++) {
    const streamMap: string[] = []
    const resolution = resolutions[i]
    const resolutionFPS = computeFPS(fps, resolution)

    const baseEncoderBuilderParams = {
      input: inputUrl,

      availableEncoders,
      profile,

      canCopyAudio: true,
      canCopyVideo: true,

      inputBitrate: bitrate,
      inputRatio: ratio,

      resolution,
      fps: resolutionFPS,

      streamNum: i,
      videoType: 'live' as 'live'
    }

    {
      const streamType: StreamType = 'video'
      const builderResult = await getEncoderBuilderResult({ ...baseEncoderBuilderParams, streamType })
      if (!builderResult) {
        throw new Error('No available live video encoder found')
      }

      command.outputOption(`-map [vout${resolution}]`)

      addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps: resolutionFPS, streamNum: i })

      logger.debug(
        'Apply ffmpeg live video params from %s using %s profile.', builderResult.encoder, profile,
        { builderResult, fps: resolutionFPS, resolution, ...lTags() }
      )

      command.outputOption(`${buildStreamSuffix('-c:v', i)} ${builderResult.encoder}`)
      applyEncoderOptions(command, builderResult.result)

      complexFilter.push({
        inputs: `vtemp${resolution}`,
        filter: getScaleFilter(builderResult.result),
        options: `w=-2:h=${resolution}`,
        outputs: `vout${resolution}`
      })

      streamMap.push(`v:${i}`)
    }

    if (hasAudio) {
      const streamType: StreamType = 'audio'
      const builderResult = await getEncoderBuilderResult({ ...baseEncoderBuilderParams, streamType })
      if (!builderResult) {
        throw new Error('No available live audio encoder found')
      }

      command.outputOption('-map a:0')

      addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps: resolutionFPS, streamNum: i })

      logger.debug(
        'Apply ffmpeg live audio params from %s using %s profile.', builderResult.encoder, profile,
        { builderResult, fps: resolutionFPS, resolution, ...lTags() }
      )

      command.outputOption(`${buildStreamSuffix('-c:a', i)} ${builderResult.encoder}`)
      applyEncoderOptions(command, builderResult.result)

      streamMap.push(`a:${i}`)
    }

    varStreamMap.push(streamMap.join(','))
  }

  command.complexFilter(complexFilter)

  addDefaultLiveHLSParams({ command, outPath, masterPlaylistName, latencyMode })

  command.outputOption('-var_stream_map', varStreamMap.join(' '))

  return command
}

function getLiveMuxingCommand (options: {
  inputUrl: string
  outPath: string
  masterPlaylistName: string
  latencyMode: LiveVideoLatencyMode
}) {
  const { inputUrl, outPath, masterPlaylistName, latencyMode } = options

  const command = getFFmpeg(inputUrl, 'live')

  command.outputOption('-c:v copy')
  command.outputOption('-c:a copy')
  command.outputOption('-map 0:a?')
  command.outputOption('-map 0:v?')

  addDefaultLiveHLSParams({ command, outPath, masterPlaylistName, latencyMode })

  return command
}

function getLiveSegmentTime (latencyMode: LiveVideoLatencyMode) {
  if (latencyMode === LiveVideoLatencyMode.SMALL_LATENCY) {
    return VIDEO_LIVE.SEGMENT_TIME_SECONDS.SMALL_LATENCY
  }

  return VIDEO_LIVE.SEGMENT_TIME_SECONDS.DEFAULT_LATENCY
}

// ---------------------------------------------------------------------------

export {
  getLiveSegmentTime,

  getLiveTranscodingCommand,
  getLiveMuxingCommand
}

// ---------------------------------------------------------------------------

function addDefaultLiveHLSParams (options: {
  command: FfmpegCommand
  outPath: string
  masterPlaylistName: string
  latencyMode: LiveVideoLatencyMode
}) {
  const { command, outPath, masterPlaylistName, latencyMode } = options

  command.outputOption('-hls_time ' + getLiveSegmentTime(latencyMode))
  command.outputOption('-hls_list_size ' + VIDEO_LIVE.SEGMENTS_LIST_SIZE)
  command.outputOption('-hls_flags delete_segments+independent_segments+program_date_time')
  command.outputOption(`-hls_segment_filename ${join(outPath, '%v-%06d.ts')}`)
  command.outputOption('-master_pl_name ' + masterPlaylistName)
  command.outputOption(`-f hls`)

  command.output(join(outPath, '%v.m3u8'))
}
