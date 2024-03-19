import { pick } from '@peertube/peertube-core-utils'
import { FfprobeData, FilterSpecification } from 'fluent-ffmpeg'
import { join } from 'path'
import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper.js'
import { StreamType, buildStreamSuffix, getScaleFilter } from './ffmpeg-utils.js'
import { addDefaultEncoderGlobalParams, addDefaultEncoderParams, applyEncoderOptions } from './shared/index.js'

export class FFmpegLive {
  private readonly commandWrapper: FFmpegCommandWrapper

  constructor (options: FFmpegCommandWrapperOptions) {
    this.commandWrapper = new FFmpegCommandWrapper(options)
  }

  async getLiveTranscodingCommand (options: {
    inputUrl: string

    outPath: string
    masterPlaylistName: string

    toTranscode: {
      resolution: number
      fps: number
    }[]

    // Input information
    bitrate: number
    ratio: number
    hasAudio: boolean
    probe: FfprobeData

    segmentListSize: number
    segmentDuration: number
  }) {
    const {
      inputUrl,
      outPath,
      toTranscode,
      bitrate,
      masterPlaylistName,
      ratio,
      hasAudio,
      probe
    } = options
    const command = this.commandWrapper.buildCommand(inputUrl)

    const varStreamMap: string[] = []

    const complexFilter: FilterSpecification[] = [
      {
        inputs: '[v:0]',
        filter: 'split',
        options: toTranscode.length,
        outputs: toTranscode.map(t => `vtemp${t.resolution}`)
      }
    ]

    command.outputOption('-sc_threshold 0')

    addDefaultEncoderGlobalParams(command)

    for (let i = 0; i < toTranscode.length; i++) {
      const streamMap: string[] = []
      const { resolution, fps } = toTranscode[i]

      const baseEncoderBuilderParams = {
        input: inputUrl,

        canCopyAudio: true,
        canCopyVideo: true,

        inputBitrate: bitrate,
        inputRatio: ratio,
        inputProbe: probe,

        resolution,
        fps,

        streamNum: i,
        videoType: 'live' as 'live'
      }

      {
        const streamType: StreamType = 'video'

        const builderResult = await this.commandWrapper.getEncoderBuilderResult({ ...baseEncoderBuilderParams, streamType })
        if (!builderResult) {
          throw new Error('No available live video encoder found')
        }

        command.outputOption(`-map [vout${resolution}]`)

        addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps, streamNum: i })

        this.commandWrapper.debugLog(
          `Apply ffmpeg live video params from ${builderResult.encoder} using ${this.commandWrapper.getProfile()} profile.`,
          { builderResult, fps, toTranscode }
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

        const builderResult = await this.commandWrapper.getEncoderBuilderResult({ ...baseEncoderBuilderParams, streamType })
        if (!builderResult) {
          throw new Error('No available live audio encoder found')
        }

        command.outputOption('-map a:0')

        addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps, streamNum: i })

        this.commandWrapper.debugLog(
          `Apply ffmpeg live audio params from ${builderResult.encoder} using ${this.commandWrapper.getProfile()} profile.`,
          { builderResult, fps, resolution }
        )

        command.outputOption(`${buildStreamSuffix('-c:a', i)} ${builderResult.encoder}`)
        applyEncoderOptions(command, builderResult.result)

        streamMap.push(`a:${i}`)
      }

      varStreamMap.push(streamMap.join(','))
    }

    command.complexFilter(complexFilter)

    this.addDefaultLiveHLSParams({ ...pick(options, [ 'segmentDuration', 'segmentListSize' ]), outPath, masterPlaylistName })

    command.outputOption('-var_stream_map', varStreamMap.join(' '))

    return command
  }

  getLiveMuxingCommand (options: {
    inputUrl: string
    outPath: string
    masterPlaylistName: string

    segmentListSize: number
    segmentDuration: number
  }) {
    const { inputUrl, outPath, masterPlaylistName } = options

    const command = this.commandWrapper.buildCommand(inputUrl)

    command.outputOption('-c:v copy')
    command.outputOption('-c:a copy')
    command.outputOption('-map 0:a?')
    command.outputOption('-map 0:v?')

    this.addDefaultLiveHLSParams({ ...pick(options, [ 'segmentDuration', 'segmentListSize' ]), outPath, masterPlaylistName })

    return command
  }

  private addDefaultLiveHLSParams (options: {
    outPath: string
    masterPlaylistName: string
    segmentListSize: number
    segmentDuration: number
  }) {
    const { outPath, masterPlaylistName, segmentListSize, segmentDuration } = options

    const command = this.commandWrapper.getCommand()

    command.outputOption('-hls_time ' + segmentDuration)
    command.outputOption('-hls_list_size ' + segmentListSize)
    command.outputOption('-hls_flags delete_segments+independent_segments+program_date_time')
    command.outputOption(`-hls_segment_filename ${join(outPath, '%v-%06d.ts')}`)
    command.outputOption('-master_pl_name ' + masterPlaylistName)
    command.outputOption(`-f hls`)

    command.output(join(outPath, '%v.m3u8'))
  }
}
