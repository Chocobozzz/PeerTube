import { pick } from '@peertube/peertube-core-utils'
import { VideoResolution } from '@peertube/peertube-models'
import { MutexInterface } from 'async-mutex'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper.js'
import { ffprobePromise, getVideoStreamDimensionsInfo } from './ffprobe.js'
import { presetCopy, presetOnlyAudio, presetVOD } from './shared/presets.js'

export type TranscodeVODOptionsType = 'hls' | 'hls-from-ts' | 'quick-transcode' | 'video' | 'merge-audio'

export interface BaseTranscodeVODOptions {
  type: TranscodeVODOptionsType

  inputPath: string
  outputPath: string

  // Will be released after the ffmpeg started
  // To prevent a bug where the input file does not exist anymore when running ffmpeg
  inputFileMutexReleaser: MutexInterface.Releaser

  resolution: number
  fps: number
}

export interface HLSTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'hls'

  copyCodecs: boolean

  hlsPlaylist: {
    videoFilename: string
  }
}

export interface HLSFromTSTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'hls-from-ts'

  isAAC: boolean

  hlsPlaylist: {
    videoFilename: string
  }
}

export interface QuickTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'quick-transcode'
}

export interface VideoTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'video'
}

export interface MergeAudioTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'merge-audio'
  audioPath: string
}

export type TranscodeVODOptions =
  HLSTranscodeOptions
  | HLSFromTSTranscodeOptions
  | VideoTranscodeOptions
  | MergeAudioTranscodeOptions
  | QuickTranscodeOptions

// ---------------------------------------------------------------------------

export class FFmpegVOD {
  private readonly commandWrapper: FFmpegCommandWrapper

  private ended = false

  constructor (options: FFmpegCommandWrapperOptions) {
    this.commandWrapper = new FFmpegCommandWrapper(options)
  }

  async transcode (options: TranscodeVODOptions) {
    const builders: {
      [ type in TranscodeVODOptionsType ]: (options: TranscodeVODOptions) => Promise<void> | void
    } = {
      'quick-transcode': this.buildQuickTranscodeCommand.bind(this),
      'hls': this.buildHLSVODCommand.bind(this),
      'hls-from-ts': this.buildHLSVODFromTSCommand.bind(this),
      'merge-audio': this.buildAudioMergeCommand.bind(this),
      'video': this.buildWebVideoCommand.bind(this)
    }

    this.commandWrapper.debugLog('Will run transcode.', { options })

    const command = this.commandWrapper.buildCommand(options.inputPath)
      .output(options.outputPath)

    await builders[options.type](options)

    command.on('start', () => {
      setTimeout(() => {
        if (options.inputFileMutexReleaser) {
          options.inputFileMutexReleaser()
        }
      }, 1000)
    })

    await this.commandWrapper.runCommand()

    await this.fixHLSPlaylistIfNeeded(options)

    this.ended = true
  }

  isEnded () {
    return this.ended
  }

  private async buildWebVideoCommand (options: TranscodeVODOptions) {
    const { resolution, fps, inputPath } = options

    if (resolution === VideoResolution.H_NOVIDEO) {
      presetOnlyAudio(this.commandWrapper)
      return
    }

    let scaleFilterValue: string

    if (resolution !== undefined) {
      const probe = await ffprobePromise(inputPath)
      const videoStreamInfo = await getVideoStreamDimensionsInfo(inputPath, probe)

      scaleFilterValue = videoStreamInfo?.isPortraitMode === true
        ? `w=${resolution}:h=-2`
        : `w=-2:h=${resolution}`
    }

    await presetVOD({
      commandWrapper: this.commandWrapper,

      resolution,
      input: inputPath,
      canCopyAudio: true,
      canCopyVideo: true,
      fps,
      scaleFilterValue
    })
  }

  private buildQuickTranscodeCommand (_options: TranscodeVODOptions) {
    const command = this.commandWrapper.getCommand()

    presetCopy(this.commandWrapper)

    command.outputOption('-map_metadata -1') // strip all metadata
      .outputOption('-movflags faststart')
  }

  // ---------------------------------------------------------------------------
  // Audio transcoding
  // ---------------------------------------------------------------------------

  private async buildAudioMergeCommand (options: MergeAudioTranscodeOptions) {
    const command = this.commandWrapper.getCommand()

    command.loop(undefined)

    await presetVOD({
      ...pick(options, [ 'resolution' ]),

      commandWrapper: this.commandWrapper,
      input: options.audioPath,
      canCopyAudio: true,
      canCopyVideo: true,
      fps: options.fps,
      scaleFilterValue: this.getMergeAudioScaleFilterValue()
    })

    command.outputOption('-preset:v veryfast')

    command.input(options.audioPath)
      .outputOption('-tune stillimage')
      .outputOption('-shortest')
  }

  // Avoid "height not divisible by 2" error
  private getMergeAudioScaleFilterValue () {
    return 'trunc(iw/2)*2:trunc(ih/2)*2'
  }

  // ---------------------------------------------------------------------------
  // HLS transcoding
  // ---------------------------------------------------------------------------

  private async buildHLSVODCommand (options: HLSTranscodeOptions) {
    const command = this.commandWrapper.getCommand()

    const videoPath = this.getHLSVideoPath(options)

    if (options.copyCodecs) presetCopy(this.commandWrapper)
    else if (options.resolution === VideoResolution.H_NOVIDEO) presetOnlyAudio(this.commandWrapper)
    else await this.buildWebVideoCommand(options)

    this.addCommonHLSVODCommandOptions(command, videoPath)
  }

  private buildHLSVODFromTSCommand (options: HLSFromTSTranscodeOptions) {
    const command = this.commandWrapper.getCommand()

    const videoPath = this.getHLSVideoPath(options)

    command.outputOption('-c copy')

    if (options.isAAC) {
      // Required for example when copying an AAC stream from an MPEG-TS
      // Since it's a bitstream filter, we don't need to reencode the audio
      command.outputOption('-bsf:a aac_adtstoasc')
    }

    this.addCommonHLSVODCommandOptions(command, videoPath)
  }

  private addCommonHLSVODCommandOptions (command: FfmpegCommand, outputPath: string) {
    return command.outputOption('-hls_time 4')
                  .outputOption('-hls_list_size 0')
                  .outputOption('-hls_playlist_type vod')
                  .outputOption('-hls_segment_filename ' + outputPath)
                  .outputOption('-hls_segment_type fmp4')
                  .outputOption('-f hls')
                  .outputOption('-hls_flags single_file')
  }

  private async fixHLSPlaylistIfNeeded (options: TranscodeVODOptions) {
    if (options.type !== 'hls' && options.type !== 'hls-from-ts') return

    const fileContent = await readFile(options.outputPath)

    const videoFileName = options.hlsPlaylist.videoFilename
    const videoFilePath = this.getHLSVideoPath(options)

    // Fix wrong mapping with some ffmpeg versions
    const newContent = fileContent.toString()
                                  .replace(`#EXT-X-MAP:URI="${videoFilePath}",`, `#EXT-X-MAP:URI="${videoFileName}",`)

    await writeFile(options.outputPath, newContent)
  }

  private getHLSVideoPath (options: HLSTranscodeOptions | HLSFromTSTranscodeOptions) {
    return `${dirname(options.outputPath)}/${options.hlsPlaylist.videoFilename}`
  }
}
