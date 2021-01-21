import { Job } from 'bull'
import * as ffmpeg from 'fluent-ffmpeg'
import { readFile, remove, writeFile } from 'fs-extra'
import { dirname, join } from 'path'
import { FFMPEG_NICE, VIDEO_LIVE, VIDEO_TRANSCODING_ENCODERS } from '@server/initializers/constants'
import { VideoResolution } from '../../shared/models/videos'
import { checkFFmpegEncoders } from '../initializers/checker-before-init'
import { CONFIG } from '../initializers/config'
import { computeFPS, getAudioStream, getVideoFileFPS } from './ffprobe-utils'
import { processImage } from './image-utils'
import { logger } from './logger'

/**
 *
 * Functions that run transcoding/muxing ffmpeg processes
 * Mainly called by lib/video-transcoding.ts and lib/live-manager.ts
 *
 */

// ---------------------------------------------------------------------------
// Encoder options
// ---------------------------------------------------------------------------

// Options builders

export type EncoderOptionsBuilder = (params: {
  input: string
  resolution: VideoResolution
  fps?: number
  streamNum?: number
}) => Promise<EncoderOptions> | EncoderOptions

// Options types

export interface EncoderOptions {
  copy?: boolean
  outputOptions: string[]
}

// All our encoders

export interface EncoderProfile <T> {
  [ profile: string ]: T

  default: T
}

export type AvailableEncoders = {
  [ id in 'live' | 'vod' ]: {
    [ encoder in 'libx264' | 'aac' | 'libfdk_aac' ]?: EncoderProfile<EncoderOptionsBuilder>
  }
}

// ---------------------------------------------------------------------------
// Image manipulation
// ---------------------------------------------------------------------------

function convertWebPToJPG (path: string, destination: string): Promise<void> {
  const command = ffmpeg(path)
    .output(destination)

  return runCommand(command)
}

function processGIF (
  path: string,
  destination: string,
  newSize: { width: number, height: number }
): Promise<void> {
  const command = ffmpeg(path)
    .fps(20)
    .size(`${newSize.width}x${newSize.height}`)
    .output(destination)

  return runCommand(command)
}

async function generateImageFromVideoFile (fromPath: string, folder: string, imageName: string, size: { width: number, height: number }) {
  const pendingImageName = 'pending-' + imageName

  const options = {
    filename: pendingImageName,
    count: 1,
    folder
  }

  const pendingImagePath = join(folder, pendingImageName)

  try {
    await new Promise<string>((res, rej) => {
      ffmpeg(fromPath, { niceness: FFMPEG_NICE.THUMBNAIL })
        .on('error', rej)
        .on('end', () => res(imageName))
        .thumbnail(options)
    })

    const destination = join(folder, imageName)
    await processImage(pendingImagePath, destination, size)
  } catch (err) {
    logger.error('Cannot generate image from video %s.', fromPath, { err })

    try {
      await remove(pendingImagePath)
    } catch (err) {
      logger.debug('Cannot remove pending image path after generation error.', { err })
    }
  }
}

// ---------------------------------------------------------------------------
// Transcode meta function
// ---------------------------------------------------------------------------

type TranscodeOptionsType = 'hls' | 'hls-from-ts' | 'quick-transcode' | 'video' | 'merge-audio' | 'only-audio'

interface BaseTranscodeOptions {
  type: TranscodeOptionsType

  inputPath: string
  outputPath: string

  availableEncoders: AvailableEncoders
  profile: string

  resolution: VideoResolution

  isPortraitMode?: boolean

  job?: Job
}

interface HLSTranscodeOptions extends BaseTranscodeOptions {
  type: 'hls'
  copyCodecs: boolean
  hlsPlaylist: {
    videoFilename: string
  }
}

interface HLSFromTSTranscodeOptions extends BaseTranscodeOptions {
  type: 'hls-from-ts'

  isAAC: boolean

  hlsPlaylist: {
    videoFilename: string
  }
}

interface QuickTranscodeOptions extends BaseTranscodeOptions {
  type: 'quick-transcode'
}

interface VideoTranscodeOptions extends BaseTranscodeOptions {
  type: 'video'
}

interface MergeAudioTranscodeOptions extends BaseTranscodeOptions {
  type: 'merge-audio'
  audioPath: string
}

interface OnlyAudioTranscodeOptions extends BaseTranscodeOptions {
  type: 'only-audio'
}

type TranscodeOptions =
  HLSTranscodeOptions
  | HLSFromTSTranscodeOptions
  | VideoTranscodeOptions
  | MergeAudioTranscodeOptions
  | OnlyAudioTranscodeOptions
  | QuickTranscodeOptions

const builders: {
  [ type in TranscodeOptionsType ]: (c: ffmpeg.FfmpegCommand, o?: TranscodeOptions) => Promise<ffmpeg.FfmpegCommand> | ffmpeg.FfmpegCommand
} = {
  'quick-transcode': buildQuickTranscodeCommand,
  'hls': buildHLSVODCommand,
  'hls-from-ts': buildHLSVODFromTSCommand,
  'merge-audio': buildAudioMergeCommand,
  'only-audio': buildOnlyAudioCommand,
  'video': buildx264VODCommand
}

async function transcode (options: TranscodeOptions) {
  logger.debug('Will run transcode.', { options })

  let command = getFFmpeg(options.inputPath, 'vod')
    .output(options.outputPath)

  command = await builders[options.type](command, options)

  await runCommand(command, options.job)

  await fixHLSPlaylistIfNeeded(options)
}

// ---------------------------------------------------------------------------
// Live muxing/transcoding functions
// ---------------------------------------------------------------------------

async function getLiveTranscodingCommand (options: {
  rtmpUrl: string
  outPath: string
  resolutions: number[]
  fps: number

  availableEncoders: AvailableEncoders
  profile: string
}) {
  const { rtmpUrl, outPath, resolutions, fps, availableEncoders, profile } = options
  const input = rtmpUrl

  const command = getFFmpeg(input, 'live')

  const varStreamMap: string[] = []

  command.complexFilter([
    {
      inputs: '[v:0]',
      filter: 'split',
      options: resolutions.length,
      outputs: resolutions.map(r => `vtemp${r}`)
    },

    ...resolutions.map(r => ({
      inputs: `vtemp${r}`,
      filter: 'scale',
      options: `w=-2:h=${r}`,
      outputs: `vout${r}`
    }))
  ])

  command.outputOption('-preset superfast')
  command.outputOption('-sc_threshold 0')

  addDefaultEncoderGlobalParams({ command })

  for (let i = 0; i < resolutions.length; i++) {
    const resolution = resolutions[i]
    const resolutionFPS = computeFPS(fps, resolution)

    const baseEncoderBuilderParams = {
      input,
      availableEncoders,
      profile,
      fps: resolutionFPS,
      resolution,
      streamNum: i,
      videoType: 'live' as 'live'
    }

    {
      const builderResult = await getEncoderBuilderResult(Object.assign({}, baseEncoderBuilderParams, { streamType: 'VIDEO' }))
      if (!builderResult) {
        throw new Error('No available live video encoder found')
      }

      command.outputOption(`-map [vout${resolution}]`)

      addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps: resolutionFPS, streamNum: i })

      logger.debug('Apply ffmpeg live video params from %s.', builderResult.encoder, builderResult)

      command.outputOption(`${buildStreamSuffix('-c:v', i)} ${builderResult.encoder}`)
      command.addOutputOptions(builderResult.result.outputOptions)
    }

    {
      const builderResult = await getEncoderBuilderResult(Object.assign({}, baseEncoderBuilderParams, { streamType: 'AUDIO' }))
      if (!builderResult) {
        throw new Error('No available live audio encoder found')
      }

      command.outputOption('-map a:0')

      addDefaultEncoderParams({ command, encoder: builderResult.encoder, fps: resolutionFPS, streamNum: i })

      logger.debug('Apply ffmpeg live audio params from %s.', builderResult.encoder, builderResult)

      command.outputOption(`${buildStreamSuffix('-c:a', i)} ${builderResult.encoder}`)
      command.addOutputOptions(builderResult.result.outputOptions)
    }

    varStreamMap.push(`v:${i},a:${i}`)
  }

  addDefaultLiveHLSParams(command, outPath)

  command.outputOption('-var_stream_map', varStreamMap.join(' '))

  return command
}

function getLiveMuxingCommand (rtmpUrl: string, outPath: string) {
  const command = getFFmpeg(rtmpUrl, 'live')

  command.outputOption('-c:v copy')
  command.outputOption('-c:a copy')
  command.outputOption('-map 0:a?')
  command.outputOption('-map 0:v?')

  addDefaultLiveHLSParams(command, outPath)

  return command
}

function buildStreamSuffix (base: string, streamNum?: number) {
  if (streamNum !== undefined) {
    return `${base}:${streamNum}`
  }

  return base
}

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

function addDefaultEncoderGlobalParams (options: {
  command: ffmpeg.FfmpegCommand
}) {
  const { command } = options

  // avoid issues when transcoding some files: https://trac.ffmpeg.org/ticket/6375
  command.outputOption('-max_muxing_queue_size 1024')
         // strip all metadata
         .outputOption('-map_metadata -1')
         // NOTE: b-strategy 1 - heuristic algorithm, 16 is optimal B-frames for it
         .outputOption('-b_strategy 1')
         // NOTE: Why 16: https://github.com/Chocobozzz/PeerTube/pull/774. b-strategy 2 -> B-frames<16
         .outputOption('-bf 16')
         // allows import of source material with incompatible pixel formats (e.g. MJPEG video)
         .outputOption('-pix_fmt yuv420p')
}

function addDefaultEncoderParams (options: {
  command: ffmpeg.FfmpegCommand
  encoder: 'libx264' | string
  streamNum?: number
  fps?: number
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

function addDefaultLiveHLSParams (command: ffmpeg.FfmpegCommand, outPath: string) {
  command.outputOption('-hls_time ' + VIDEO_LIVE.SEGMENT_TIME_SECONDS)
  command.outputOption('-hls_list_size ' + VIDEO_LIVE.SEGMENTS_LIST_SIZE)
  command.outputOption('-hls_flags delete_segments+independent_segments')
  command.outputOption(`-hls_segment_filename ${join(outPath, '%v-%06d.ts')}`)
  command.outputOption('-master_pl_name master.m3u8')
  command.outputOption(`-f hls`)

  command.output(join(outPath, '%v.m3u8'))
}

// ---------------------------------------------------------------------------
// Transcode VOD command builders
// ---------------------------------------------------------------------------

async function buildx264VODCommand (command: ffmpeg.FfmpegCommand, options: TranscodeOptions) {
  let fps = await getVideoFileFPS(options.inputPath)
  fps = computeFPS(fps, options.resolution)

  command = await presetVideo(command, options.inputPath, options, fps)

  if (options.resolution !== undefined) {
    // '?x720' or '720x?' for example
    const size = options.isPortraitMode === true
      ? `${options.resolution}x?`
      : `?x${options.resolution}`

    command = command.size(size)
  }

  return command
}

async function buildAudioMergeCommand (command: ffmpeg.FfmpegCommand, options: MergeAudioTranscodeOptions) {
  command = command.loop(undefined)

  command = await presetVideo(command, options.audioPath, options)

  command.outputOption('-preset:v veryfast')

  command = command.input(options.audioPath)
                   .videoFilter('scale=trunc(iw/2)*2:trunc(ih/2)*2') // Avoid "height not divisible by 2" error
                   .outputOption('-tune stillimage')
                   .outputOption('-shortest')

  return command
}

function buildOnlyAudioCommand (command: ffmpeg.FfmpegCommand, _options: OnlyAudioTranscodeOptions) {
  command = presetOnlyAudio(command)

  return command
}

function buildQuickTranscodeCommand (command: ffmpeg.FfmpegCommand) {
  command = presetCopy(command)

  command = command.outputOption('-map_metadata -1') // strip all metadata
                   .outputOption('-movflags faststart')

  return command
}

function addCommonHLSVODCommandOptions (command: ffmpeg.FfmpegCommand, outputPath: string) {
  return command.outputOption('-hls_time 4')
                .outputOption('-hls_list_size 0')
                .outputOption('-hls_playlist_type vod')
                .outputOption('-hls_segment_filename ' + outputPath)
                .outputOption('-hls_segment_type fmp4')
                .outputOption('-f hls')
                .outputOption('-hls_flags single_file')
}

async function buildHLSVODCommand (command: ffmpeg.FfmpegCommand, options: HLSTranscodeOptions) {
  const videoPath = getHLSVideoPath(options)

  if (options.copyCodecs) command = presetCopy(command)
  else if (options.resolution === VideoResolution.H_NOVIDEO) command = presetOnlyAudio(command)
  else command = await buildx264VODCommand(command, options)

  addCommonHLSVODCommandOptions(command, videoPath)

  return command
}

async function buildHLSVODFromTSCommand (command: ffmpeg.FfmpegCommand, options: HLSFromTSTranscodeOptions) {
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

async function fixHLSPlaylistIfNeeded (options: TranscodeOptions) {
  if (options.type !== 'hls' && options.type !== 'hls-from-ts') return

  const fileContent = await readFile(options.outputPath)

  const videoFileName = options.hlsPlaylist.videoFilename
  const videoFilePath = getHLSVideoPath(options)

  // Fix wrong mapping with some ffmpeg versions
  const newContent = fileContent.toString()
                                .replace(`#EXT-X-MAP:URI="${videoFilePath}",`, `#EXT-X-MAP:URI="${videoFileName}",`)

  await writeFile(options.outputPath, newContent)
}

function getHLSVideoPath (options: HLSTranscodeOptions | HLSFromTSTranscodeOptions) {
  return `${dirname(options.outputPath)}/${options.hlsPlaylist.videoFilename}`
}

// ---------------------------------------------------------------------------
// Transcoding presets
// ---------------------------------------------------------------------------

async function getEncoderBuilderResult (options: {
  streamType: string
  input: string

  availableEncoders: AvailableEncoders
  profile: string

  videoType: 'vod' | 'live'

  resolution: number
  fps?: number
  streamNum?: number
}) {
  const { availableEncoders, input, profile, resolution, streamType, fps, streamNum, videoType } = options

  const encodersToTry: string[] = VIDEO_TRANSCODING_ENCODERS[streamType]

  for (const encoder of encodersToTry) {
    if (!(await checkFFmpegEncoders()).get(encoder) || !availableEncoders[videoType][encoder]) continue

    const builderProfiles: EncoderProfile<EncoderOptionsBuilder> = availableEncoders[videoType][encoder]
    let builder = builderProfiles[profile]

    if (!builder) {
      logger.debug('Profile %s for encoder %s not available. Fallback to default.', profile, encoder)
      builder = builderProfiles.default
    }

    const result = await builder({ input, resolution: resolution, fps, streamNum })

    return {
      result,

      // If we don't have output options, then copy the input stream
      encoder: result.copy === true
        ? 'copy'
        : encoder
    }
  }

  return null
}

async function presetVideo (
  command: ffmpeg.FfmpegCommand,
  input: string,
  transcodeOptions: TranscodeOptions,
  fps?: number
) {
  let localCommand = command
    .format('mp4')
    .outputOption('-movflags faststart')

  addDefaultEncoderGlobalParams({ command })

  // Audio encoder
  const parsedAudio = await getAudioStream(input)

  let streamsToProcess = [ 'AUDIO', 'VIDEO' ]

  if (!parsedAudio.audioStream) {
    localCommand = localCommand.noAudio()
    streamsToProcess = [ 'VIDEO' ]
  }

  for (const streamType of streamsToProcess) {
    const { profile, resolution, availableEncoders } = transcodeOptions

    const builderResult = await getEncoderBuilderResult({
      streamType,
      input,
      resolution,
      availableEncoders,
      profile,
      fps,
      videoType: 'vod' as 'vod'
    })

    if (!builderResult) {
      throw new Error('No available encoder found for stream ' + streamType)
    }

    logger.debug('Apply ffmpeg params from %s.', builderResult.encoder, builderResult)

    if (streamType === 'VIDEO') {
      localCommand.videoCodec(builderResult.encoder)
    } else if (streamType === 'AUDIO') {
      localCommand.audioCodec(builderResult.encoder)
    }

    command.addOutputOptions(builderResult.result.outputOptions)
    addDefaultEncoderParams({ command: localCommand, encoder: builderResult.encoder, fps })
  }

  return localCommand
}

function presetCopy (command: ffmpeg.FfmpegCommand): ffmpeg.FfmpegCommand {
  return command
    .format('mp4')
    .videoCodec('copy')
    .audioCodec('copy')
}

function presetOnlyAudio (command: ffmpeg.FfmpegCommand): ffmpeg.FfmpegCommand {
  return command
    .format('mp4')
    .audioCodec('copy')
    .noVideo()
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function getFFmpeg (input: string, type: 'live' | 'vod') {
  // We set cwd explicitly because ffmpeg appears to create temporary files when trancoding which fails in read-only file systems
  const command = ffmpeg(input, {
    niceness: type === 'live' ? FFMPEG_NICE.LIVE : FFMPEG_NICE.VOD,
    cwd: CONFIG.STORAGE.TMP_DIR
  })

  const threads = type === 'live'
    ? CONFIG.LIVE.TRANSCODING.THREADS
    : CONFIG.TRANSCODING.THREADS

  if (threads > 0) {
    // If we don't set any threads ffmpeg will chose automatically
    command.outputOption('-threads ' + threads)
  }

  return command
}

async function runCommand (command: ffmpeg.FfmpegCommand, job?: Job) {
  return new Promise<void>((res, rej) => {
    command.on('error', (err, stdout, stderr) => {
      logger.error('Error in transcoding job.', { stdout, stderr })
      rej(err)
    })

    command.on('end', (stdout, stderr) => {
      logger.debug('FFmpeg command ended.', { stdout, stderr })

      res()
    })

    if (job) {
      command.on('progress', progress => {
        if (!progress.percent) return

        job.progress(Math.round(progress.percent))
          .catch(err => logger.warn('Cannot set ffmpeg job progress.', { err }))
      })
    }

    command.run()
  })
}

// ---------------------------------------------------------------------------

export {
  getLiveTranscodingCommand,
  getLiveMuxingCommand,
  buildStreamSuffix,
  convertWebPToJPG,
  processGIF,
  generateImageFromVideoFile,
  TranscodeOptions,
  TranscodeOptionsType,
  transcode,
  runCommand,

  // builders
  buildx264VODCommand
}
