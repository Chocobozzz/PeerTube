import { pick } from '@peertube/peertube-core-utils'
import { VideoResolution } from '@peertube/peertube-models'
import { FfmpegCommand, FfprobeData, FilterSpecification } from 'fluent-ffmpeg'
import { join } from 'path'
import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper.js'
import { StreamType, buildStreamSuffix, getScaleFilter } from './ffmpeg-utils.js'
import { addDefaultEncoderGlobalParams, addDefaultEncoderParams, applyEncoderOptions } from './shared/index.js'

type LiveTranscodingOptions = {
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
  hasVideo: boolean
  probe: FfprobeData

  segmentListSize: number
  segmentDuration: number

  splitAudioAndVideo: boolean
}

export class FFmpegLive {
  private readonly commandWrapper: FFmpegCommandWrapper

  constructor (options: FFmpegCommandWrapperOptions) {
    this.commandWrapper = new FFmpegCommandWrapper(options)
  }

  async getLiveTranscodingCommand (options: LiveTranscodingOptions) {
    this.commandWrapper.debugLog('Building live transcoding command', options)

    const {
      inputUrl,
      outPath,
      toTranscode,
      masterPlaylistName,
      hasAudio,
      splitAudioAndVideo
    } = options

    const command = this.commandWrapper.buildCommand(inputUrl)

    let varStreamMap: string[] = []

    command.outputOption('-sc_threshold 0')

    addDefaultEncoderGlobalParams(command)

    // Audio input only or audio output only
    if (this.isAudioInputOrOutputOnly(options)) {
      const result = await this.buildTranscodingStream({
        ...options,

        command,
        resolution: toTranscode[0].resolution,
        fps: toTranscode[0].fps,
        streamNum: 0,
        // No need to add complexity to the m3u8 playlist, we just provide 1 audio variant stream
        splitAudioAndVideo: false,
        streamType: 'audio'
      })

      varStreamMap = varStreamMap.concat(result.varStreamMap)
      varStreamMap.push(result.streamMap.join(','))
    } else {
      // Do not mix video with audio only playlist
      // Audio only input/output is already taken into account above
      const toTranscodeWithoutAudioOnly = toTranscode.filter(t => t.resolution !== VideoResolution.H_NOVIDEO)

      let complexFilter: FilterSpecification[] = [
        {
          inputs: '[v:0]',
          filter: 'split',
          options: toTranscodeWithoutAudioOnly.length,
          outputs: toTranscodeWithoutAudioOnly.map(t => `vtemp${t.resolution}`)
        }
      ]

      let alreadyProcessedAudio = false

      for (let i = 0; i < toTranscodeWithoutAudioOnly.length; i++) {
        let streamMap: string[] = []

        const { resolution, fps } = toTranscodeWithoutAudioOnly[i]

        for (const streamType of [ 'audio' as 'audio', 'video' as 'video' ]) {
          if (streamType === 'audio') {
            if (!hasAudio || (splitAudioAndVideo && alreadyProcessedAudio)) continue

            alreadyProcessedAudio = true
          }

          const result = await this.buildTranscodingStream({ ...options, command, resolution, fps, streamNum: i, streamType })
          varStreamMap = varStreamMap.concat(result.varStreamMap)
          streamMap = streamMap.concat(result.streamMap)
          complexFilter = complexFilter.concat(result.complexFilter)
        }

        if (streamMap.length !== 0) {
          varStreamMap.push(streamMap.join(','))
        }
      }

      command.complexFilter(complexFilter)
    }

    this.addDefaultLiveHLSParams({ ...pick(options, [ 'segmentDuration', 'segmentListSize' ]), outPath, masterPlaylistName })

    command.outputOption('-var_stream_map', varStreamMap.join(' '))

    return command
  }

  private isAudioInputOrOutputOnly (options: Pick<LiveTranscodingOptions, 'hasAudio' | 'hasVideo' | 'toTranscode'>) {
    const { hasAudio, hasVideo, toTranscode } = options

    if (hasAudio && !hasVideo) return true
    if (toTranscode.length === 1 && toTranscode[0].resolution === VideoResolution.H_NOVIDEO) return true

    return false
  }

  private async buildTranscodingStream (
    options: Pick<LiveTranscodingOptions, 'inputUrl' | 'bitrate' | 'ratio' | 'probe' | 'hasAudio' | 'splitAudioAndVideo'> & {
      command: FfmpegCommand
      resolution: number
      fps: number
      streamNum: number
      streamType: StreamType
    }
  ) {
    const { inputUrl, bitrate, ratio, probe, splitAudioAndVideo, command, resolution, fps, streamNum, streamType, hasAudio } = options

    const baseEncoderBuilderParams = {
      input: inputUrl,

      canCopyAudio: true,
      canCopyVideo: true,

      inputBitrate: bitrate,
      inputRatio: ratio,
      inputProbe: probe,

      resolution,
      fps,

      streamNum,
      videoType: 'live' as 'live'
    }

    const streamMap: string[] = []
    const varStreamMap: string[] = []
    const complexFilter: FilterSpecification[] = []

    const builderResult = await this.commandWrapper.getEncoderBuilderResult({ ...baseEncoderBuilderParams, streamType })
    if (!builderResult) {
      throw new Error(`No available live ${streamType} encoder found`)
    }

    if (streamType === 'audio') {
      command.outputOption('-map a:0')
    } else {
      command.outputOption(`-map [vout${resolution}]`)
    }

    addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps, streamNum })

    this.commandWrapper.debugLog(
      `Apply ffmpeg live ${streamType} params from ${builderResult.encoder} using ${this.commandWrapper.getProfile()} profile.`,
      { builderResult, fps, resolution }
    )

    if (streamType === 'audio') {
      command.outputOption(`${buildStreamSuffix('-c:a', streamNum)} ${builderResult.encoder}`)

      if (splitAudioAndVideo) {
        varStreamMap.push(`a:${streamNum},agroup:Audio,default:yes`)
      } else {
        streamMap.push(`a:${streamNum}`)
      }
    } else {
      command.outputOption(`${buildStreamSuffix('-c:v', streamNum)} ${builderResult.encoder}`)

      complexFilter.push({
        inputs: `vtemp${resolution}`,
        filter: getScaleFilter(builderResult.result),
        options: `w=-2:h=${resolution}`,
        outputs: `vout${resolution}`
      })

      if (splitAudioAndVideo) {
        const suffix = hasAudio
          ? `,agroup:Audio`
          : ''

        varStreamMap.push(`v:${streamNum}${suffix}`)
      } else {
        streamMap.push(`v:${streamNum}`)
      }
    }

    applyEncoderOptions(command, builderResult.result)

    return { varStreamMap, streamMap, complexFilter }
  }

  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

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
