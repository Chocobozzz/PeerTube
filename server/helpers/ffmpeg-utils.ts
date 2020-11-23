import * as ffmpeg from 'fluent-ffmpeg'
import { readFile, remove, writeFile } from 'fs-extra'
import { dirname, join } from 'path'
import { getTargetBitrate, VideoResolution } from '../../shared/models/videos'
import { checkFFmpegEncoders } from '../initializers/checker-before-init'
import { CONFIG } from '../initializers/config'
import { FFMPEG_NICE, VIDEO_LIVE, VIDEO_TRANSCODING_ENCODERS, VIDEO_TRANSCODING_FPS } from '../initializers/constants'
import { getAudioStream, getClosestFramerateStandard, getVideoFileFPS } from './ffprobe-utils'
import { processImage } from './image-utils'
import { logger } from './logger'

// ---------------------------------------------------------------------------
// Encoder options
// ---------------------------------------------------------------------------

// Options builders

export type EncoderOptionsBuilder = (params: {
  input: string
  resolution: VideoResolution
  fps?: number
}) => Promise<EncoderOptions> | EncoderOptions

// Options types

export interface EncoderOptions {
  outputOptions: string[]
}

// All our encoders

export interface EncoderProfile <T> {
  [ profile: string ]: T

  default: T
}

export type AvailableEncoders = {
  [ id in 'live' | 'vod' ]: {
    [ encoder in 'libx264' | 'aac' | 'libfdkAAC' ]: EncoderProfile<EncoderOptionsBuilder>
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
  newSize: { width: number, height: number },
  keepOriginal = false
): Promise<void> {
  return new Promise<void>(async (res, rej) => {
    if (path === destination) {
      throw new Error('FFmpeg needs an input path different that the output path.')
    }

    logger.debug('Processing gif %s to %s.', path, destination)

    try {
      const command = ffmpeg(path)
        .fps(20)
        .size(`${newSize.width}x${newSize.height}`)
        .output(destination)

      command.on('error', (err, stdout, stderr) => {
        logger.error('Error in ffmpeg gif resizing process.', { stdout, stderr })
        return rej(err)
      })
      .on('end', async () => {
        if (keepOriginal !== true) await remove(path)
        res()
      })
      .run()
    } catch (err) {
      return rej(err)
    }
  })
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

type TranscodeOptionsType = 'hls' | 'quick-transcode' | 'video' | 'merge-audio' | 'only-audio'

interface BaseTranscodeOptions {
  type: TranscodeOptionsType

  inputPath: string
  outputPath: string

  availableEncoders: AvailableEncoders
  profile: string

  resolution: VideoResolution

  isPortraitMode?: boolean
}

interface HLSTranscodeOptions extends BaseTranscodeOptions {
  type: 'hls'
  copyCodecs: boolean
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
  | VideoTranscodeOptions
  | MergeAudioTranscodeOptions
  | OnlyAudioTranscodeOptions
  | QuickTranscodeOptions

const builders: {
  [ type in TranscodeOptionsType ]: (c: ffmpeg.FfmpegCommand, o?: TranscodeOptions) => Promise<ffmpeg.FfmpegCommand> | ffmpeg.FfmpegCommand
} = {
  'quick-transcode': buildQuickTranscodeCommand,
  'hls': buildHLSVODCommand,
  'merge-audio': buildAudioMergeCommand,
  'only-audio': buildOnlyAudioCommand,
  'video': buildx264VODCommand
}

async function transcode (options: TranscodeOptions) {
  logger.debug('Will run transcode.', { options })

  let command = getFFmpeg(options.inputPath)
    .output(options.outputPath)

  command = await builders[options.type](command, options)

  await runCommand(command)

  await fixHLSPlaylistIfNeeded(options)
}

// ---------------------------------------------------------------------------
// Live muxing/transcoding functions
// ---------------------------------------------------------------------------

function getLiveTranscodingCommand (rtmpUrl: string, outPath: string, resolutions: number[], fps: number, deleteSegments: boolean) {
  const command = getFFmpeg(rtmpUrl)
  command.inputOption('-fflags nobuffer')

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

  addEncoderDefaultParams(command, 'libx264', fps)

  command.outputOption('-preset superfast')

  for (let i = 0; i < resolutions.length; i++) {
    const resolution = resolutions[i]

    command.outputOption(`-map [vout${resolution}]`)
    command.outputOption(`-c:v:${i} libx264`)
    command.outputOption(`-b:v:${i} ${getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS)}`)

    command.outputOption(`-map a:0`)
    command.outputOption(`-c:a:${i} aac`)

    varStreamMap.push(`v:${i},a:${i}`)
  }

  addDefaultLiveHLSParams(command, outPath, deleteSegments)

  command.outputOption('-var_stream_map', varStreamMap.join(' '))

  return command
}

function getLiveMuxingCommand (rtmpUrl: string, outPath: string, deleteSegments: boolean) {
  const command = getFFmpeg(rtmpUrl)
  command.inputOption('-fflags nobuffer')

  command.outputOption('-c:v copy')
  command.outputOption('-c:a copy')
  command.outputOption('-map 0:a?')
  command.outputOption('-map 0:v?')

  addDefaultLiveHLSParams(command, outPath, deleteSegments)

  return command
}

async function hlsPlaylistToFragmentedMP4 (hlsDirectory: string, segmentFiles: string[], outputPath: string) {
  const concatFilePath = join(hlsDirectory, 'concat.txt')

  function cleaner () {
    remove(concatFilePath)
      .catch(err => logger.error('Cannot remove concat file in %s.', hlsDirectory, { err }))
  }

  // First concat the ts files to a mp4 file
  const content = segmentFiles.map(f => 'file ' + f)
                              .join('\n')

  await writeFile(concatFilePath, content + '\n')

  const command = getFFmpeg(concatFilePath)
  command.inputOption('-safe 0')
  command.inputOption('-f concat')

  command.outputOption('-c:v copy')
  command.audioFilter('aresample=async=1:first_pts=0')
  command.output(outputPath)

  return runCommand(command, cleaner)
}

// ---------------------------------------------------------------------------

export {
  getLiveTranscodingCommand,
  getLiveMuxingCommand,
  convertWebPToJPG,
  processGIF,
  generateImageFromVideoFile,
  TranscodeOptions,
  TranscodeOptionsType,
  transcode,
  hlsPlaylistToFragmentedMP4
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

function addEncoderDefaultParams (command: ffmpeg.FfmpegCommand, encoder: 'libx264' | string, fps?: number) {
  if (encoder !== 'libx264') return

  command.outputOption('-level 3.1') // 3.1 is the minimal resource allocation for our highest supported resolution
         .outputOption('-b_strategy 1') // NOTE: b-strategy 1 - heuristic algorithm, 16 is optimal B-frames for it
         .outputOption('-bf 16') // NOTE: Why 16: https://github.com/Chocobozzz/PeerTube/pull/774. b-strategy 2 -> B-frames<16
         .outputOption('-pix_fmt yuv420p') // allows import of source material with incompatible pixel formats (e.g. MJPEG video)
         .outputOption('-map_metadata -1') // strip all metadata
         .outputOption('-max_muxing_queue_size 1024') // avoid issues when transcoding some files: https://trac.ffmpeg.org/ticket/6375
         // Keyframe interval of 2 seconds for faster seeking and resolution switching.
         // https://streaminglearningcenter.com/blogs/whats-the-right-keyframe-interval.html
         // https://superuser.com/a/908325
         .outputOption('-g ' + (fps * 2))
}

function addDefaultLiveHLSParams (command: ffmpeg.FfmpegCommand, outPath: string, deleteSegments: boolean) {
  command.outputOption('-hls_time ' + VIDEO_LIVE.SEGMENT_TIME_SECONDS)
  command.outputOption('-hls_list_size ' + VIDEO_LIVE.SEGMENTS_LIST_SIZE)

  if (deleteSegments === true) {
    command.outputOption('-hls_flags delete_segments')
  }

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
  if (
    // On small/medium resolutions, limit FPS
    options.resolution !== undefined &&
    options.resolution < VIDEO_TRANSCODING_FPS.KEEP_ORIGIN_FPS_RESOLUTION_MIN &&
    fps > VIDEO_TRANSCODING_FPS.AVERAGE
  ) {
    // Get closest standard framerate by modulo: downsampling has to be done to a divisor of the nominal fps value
    fps = getClosestFramerateStandard(fps, 'STANDARD')
  }

  command = await presetVideo(command, options.inputPath, options, fps)

  if (options.resolution !== undefined) {
    // '?x720' or '720x?' for example
    const size = options.isPortraitMode === true ? `${options.resolution}x?` : `?x${options.resolution}`
    command = command.size(size)
  }

  if (fps) {
    // Hard FPS limits
    if (fps > VIDEO_TRANSCODING_FPS.MAX) fps = getClosestFramerateStandard(fps, 'HD_STANDARD')
    else if (fps < VIDEO_TRANSCODING_FPS.MIN) fps = VIDEO_TRANSCODING_FPS.MIN

    command = command.withFPS(fps)
  }

  return command
}

async function buildAudioMergeCommand (command: ffmpeg.FfmpegCommand, options: MergeAudioTranscodeOptions) {
  command = command.loop(undefined)

  command = await presetVideo(command, options.audioPath, options)

  /*
  MAIN reference: https://slhck.info/video/2017/03/01/rate-control.html
  Our target situation is closer to a livestream than a stream,
  since we want to reduce as much a possible the encoding burden,
  although not to the point of a livestream where there is a hard
  constraint on the frames per second to be encoded.
  */
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

async function buildHLSVODCommand (command: ffmpeg.FfmpegCommand, options: HLSTranscodeOptions) {
  const videoPath = getHLSVideoPath(options)

  if (options.copyCodecs) command = presetCopy(command)
  else if (options.resolution === VideoResolution.H_NOVIDEO) command = presetOnlyAudio(command)
  else command = await buildx264VODCommand(command, options)

  command = command.outputOption('-hls_time 4')
                   .outputOption('-hls_list_size 0')
                   .outputOption('-hls_playlist_type vod')
                   .outputOption('-hls_segment_filename ' + videoPath)
                   .outputOption('-hls_segment_type fmp4')
                   .outputOption('-f hls')
                   .outputOption('-hls_flags single_file')

  return command
}

async function fixHLSPlaylistIfNeeded (options: TranscodeOptions) {
  if (options.type !== 'hls') return

  const fileContent = await readFile(options.outputPath)

  const videoFileName = options.hlsPlaylist.videoFilename
  const videoFilePath = getHLSVideoPath(options)

  // Fix wrong mapping with some ffmpeg versions
  const newContent = fileContent.toString()
                                .replace(`#EXT-X-MAP:URI="${videoFilePath}",`, `#EXT-X-MAP:URI="${videoFileName}",`)

  await writeFile(options.outputPath, newContent)
}

function getHLSVideoPath (options: HLSTranscodeOptions) {
  return `${dirname(options.outputPath)}/${options.hlsPlaylist.videoFilename}`
}

// ---------------------------------------------------------------------------
// Transcoding presets
// ---------------------------------------------------------------------------

async function presetVideo (
  command: ffmpeg.FfmpegCommand,
  input: string,
  transcodeOptions: TranscodeOptions,
  fps?: number
) {
  let localCommand = command
    .format('mp4')
    .outputOption('-movflags faststart')

  // Audio encoder
  const parsedAudio = await getAudioStream(input)

  let streamsToProcess = [ 'AUDIO', 'VIDEO' ]
  const streamsFound = {
    AUDIO: '',
    VIDEO: ''
  }

  if (!parsedAudio.audioStream) {
    localCommand = localCommand.noAudio()
    streamsToProcess = [ 'VIDEO' ]
  }

  for (const stream of streamsToProcess) {
    const encodersToTry: string[] = VIDEO_TRANSCODING_ENCODERS[stream]

    for (const encoder of encodersToTry) {
      if (!(await checkFFmpegEncoders()).get(encoder)) continue

      const builderProfiles: EncoderProfile<EncoderOptionsBuilder> = transcodeOptions.availableEncoders.vod[encoder]
      let builder = builderProfiles[transcodeOptions.profile]

      if (!builder) {
        logger.debug('Profile %s for encoder %s not available. Fallback to default.', transcodeOptions.profile, encoder)
        builder = builderProfiles.default
      }

      const builderResult = await builder({ input, resolution: transcodeOptions.resolution, fps })

      logger.debug('Apply ffmpeg params from %s.', encoder, builderResult)

      localCommand.outputOptions(builderResult.outputOptions)

      addEncoderDefaultParams(localCommand, encoder)

      streamsFound[stream] = encoder
      break
    }

    if (!streamsFound[stream]) {
      throw new Error('No available encoder found ' + encodersToTry.join(', '))
    }
  }

  localCommand.videoCodec(streamsFound.VIDEO)

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

function getFFmpeg (input: string) {
  // We set cwd explicitly because ffmpeg appears to create temporary files when trancoding which fails in read-only file systems
  const command = ffmpeg(input, { niceness: FFMPEG_NICE.TRANSCODING, cwd: CONFIG.STORAGE.TMP_DIR })

  if (CONFIG.TRANSCODING.THREADS > 0) {
    // If we don't set any threads ffmpeg will chose automatically
    command.outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
  }

  return command
}

async function runCommand (command: ffmpeg.FfmpegCommand, onEnd?: Function) {
  return new Promise<void>((res, rej) => {
    command.on('error', (err, stdout, stderr) => {
      if (onEnd) onEnd()

      logger.error('Error in transcoding job.', { stdout, stderr })
      rej(err)
    })

    command.on('end', () => {
      if (onEnd) onEnd()

      res()
    })

    command.run()
  })
}
