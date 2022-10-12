import { MutexInterface } from 'async-mutex'
import { Job } from 'bullmq'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { readFile, writeFile } from 'fs-extra'
import { dirname } from 'path'
import { VIDEO_TRANSCODING_FPS } from '@server/initializers/constants'
import { pick } from '@shared/core-utils'
import { AvailableEncoders, VideoResolution } from '@shared/models'
import { logger, loggerTagsFactory } from '../logger'
import { getFFmpeg, runCommand } from './ffmpeg-commons'
import { presetCopy, presetOnlyAudio, presetVOD } from './ffmpeg-presets'
import { computeFPS, ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamFPS } from './ffprobe-utils'

const lTags = loggerTagsFactory('ffmpeg')

// ---------------------------------------------------------------------------

type TranscodeVODOptionsType = 'hls' | 'hls-from-ts' | 'quick-transcode' | 'video' | 'merge-audio' | 'only-audio'

interface BaseTranscodeVODOptions {
  type: TranscodeVODOptionsType

  inputPath: string
  outputPath: string

  // Will be released after the ffmpeg started
  // To prevent a bug where the input file does not exist anymore when running ffmpeg
  inputFileMutexReleaser: MutexInterface.Releaser

  availableEncoders: AvailableEncoders
  profile: string

  resolution: number

  job?: Job
}

interface HLSTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'hls'
  copyCodecs: boolean
  hlsPlaylist: {
    videoFilename: string
  }
}

interface HLSFromTSTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'hls-from-ts'

  isAAC: boolean

  hlsPlaylist: {
    videoFilename: string
  }
}

interface QuickTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'quick-transcode'
}

interface VideoTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'video'
}

interface MergeAudioTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'merge-audio'
  audioPath: string
}

interface OnlyAudioTranscodeOptions extends BaseTranscodeVODOptions {
  type: 'only-audio'
}

type TranscodeVODOptions =
  HLSTranscodeOptions
  | HLSFromTSTranscodeOptions
  | VideoTranscodeOptions
  | MergeAudioTranscodeOptions
  | OnlyAudioTranscodeOptions
  | QuickTranscodeOptions

// ---------------------------------------------------------------------------

const builders: {
  [ type in TranscodeVODOptionsType ]: (c: FfmpegCommand, o?: TranscodeVODOptions) => Promise<FfmpegCommand> | FfmpegCommand
} = {
  'quick-transcode': buildQuickTranscodeCommand,
  'hls': buildHLSVODCommand,
  'hls-from-ts': buildHLSVODFromTSCommand,
  'merge-audio': buildAudioMergeCommand,
  'only-audio': buildOnlyAudioCommand,
  'video': buildVODCommand
}

async function transcodeVOD (options: TranscodeVODOptions) {
  logger.debug('Will run transcode.', { options, ...lTags() })

  let command = getFFmpeg(options.inputPath, 'vod')
    .output(options.outputPath)

  command = await builders[options.type](command, options)

  command.on('start', () => {
    setTimeout(() => {
      options.inputFileMutexReleaser()
    }, 1000)
  })

  await runCommand({ command, job: options.job })

  await fixHLSPlaylistIfNeeded(options)
}

// ---------------------------------------------------------------------------

export {
  transcodeVOD,

  buildVODCommand,

  TranscodeVODOptions,
  TranscodeVODOptionsType
}

// ---------------------------------------------------------------------------

async function buildVODCommand (command: FfmpegCommand, options: TranscodeVODOptions) {
  const probe = await ffprobePromise(options.inputPath)

  let fps = await getVideoStreamFPS(options.inputPath, probe)
  fps = computeFPS(fps, options.resolution)

  let scaleFilterValue: string

  if (options.resolution !== undefined) {
    const videoStreamInfo = await getVideoStreamDimensionsInfo(options.inputPath, probe)

    scaleFilterValue = videoStreamInfo?.isPortraitMode === true
      ? `w=${options.resolution}:h=-2`
      : `w=-2:h=${options.resolution}`
  }

  command = await presetVOD({
    ...pick(options, [ 'resolution', 'availableEncoders', 'profile' ]),

    command,
    input: options.inputPath,
    canCopyAudio: true,
    canCopyVideo: true,
    fps,
    scaleFilterValue
  })

  return command
}

function buildQuickTranscodeCommand (command: FfmpegCommand) {
  command = presetCopy(command)

  command = command.outputOption('-map_metadata -1') // strip all metadata
                   .outputOption('-movflags faststart')

  return command
}

// ---------------------------------------------------------------------------
// Audio transcoding
// ---------------------------------------------------------------------------

async function buildAudioMergeCommand (command: FfmpegCommand, options: MergeAudioTranscodeOptions) {
  command = command.loop(undefined)

  const scaleFilterValue = getMergeAudioScaleFilterValue()
  command = await presetVOD({
    ...pick(options, [ 'resolution', 'availableEncoders', 'profile' ]),

    command,
    input: options.audioPath,
    canCopyAudio: true,
    canCopyVideo: true,
    fps: VIDEO_TRANSCODING_FPS.AUDIO_MERGE,
    scaleFilterValue
  })

  command.outputOption('-preset:v veryfast')

  command = command.input(options.audioPath)
                   .outputOption('-tune stillimage')
                   .outputOption('-shortest')

  return command
}

function buildOnlyAudioCommand (command: FfmpegCommand, _options: OnlyAudioTranscodeOptions) {
  command = presetOnlyAudio(command)

  return command
}

// ---------------------------------------------------------------------------
// HLS transcoding
// ---------------------------------------------------------------------------

async function buildHLSVODCommand (command: FfmpegCommand, options: HLSTranscodeOptions) {
  const videoPath = getHLSVideoPath(options)

  if (options.copyCodecs) command = presetCopy(command)
  else if (options.resolution === VideoResolution.H_NOVIDEO) command = presetOnlyAudio(command)
  else command = await buildVODCommand(command, options)

  addCommonHLSVODCommandOptions(command, videoPath)

  return command
}

function buildHLSVODFromTSCommand (command: FfmpegCommand, options: HLSFromTSTranscodeOptions) {
  const videoPath = getHLSVideoPath(options)

  command.outputOption('-c copy')

  if (options.isAAC) {
    // Required for example when copying an AAC stream from an MPEG-TS
    // Since it's a bitstream filter, we don't need to reencode the audio
    command.outputOption('-bsf:a aac_adtstoasc')
  }

  addCommonHLSVODCommandOptions(command, videoPath)

  return command
}

function addCommonHLSVODCommandOptions (command: FfmpegCommand, outputPath: string) {
  return command.outputOption('-hls_time 4')
                .outputOption('-hls_list_size 0')
                .outputOption('-hls_playlist_type vod')
                .outputOption('-hls_segment_filename ' + outputPath)
                .outputOption('-hls_segment_type fmp4')
                .outputOption('-f hls')
                .outputOption('-hls_flags single_file')
}

async function fixHLSPlaylistIfNeeded (options: TranscodeVODOptions) {
  if (options.type !== 'hls' && options.type !== 'hls-from-ts') return

  const fileContent = await readFile(options.outputPath)

  const videoFileName = options.hlsPlaylist.videoFilename
  const videoFilePath = getHLSVideoPath(options)

  // Fix wrong mapping with some ffmpeg versions
  const newContent = fileContent.toString()
                                .replace(`#EXT-X-MAP:URI="${videoFilePath}",`, `#EXT-X-MAP:URI="${videoFileName}",`)

  await writeFile(options.outputPath, newContent)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHLSVideoPath (options: HLSTranscodeOptions | HLSFromTSTranscodeOptions) {
  return `${dirname(options.outputPath)}/${options.hlsPlaylist.videoFilename}`
}

// Avoid "height not divisible by 2" error
function getMergeAudioScaleFilterValue () {
  return 'trunc(iw/2)*2:trunc(ih/2)*2'
}
