import * as ffmpeg from 'fluent-ffmpeg'
import { dirname, join } from 'path'
import { getMaxBitrate, getTargetBitrate, VideoResolution } from '../../shared/models/videos'
import { FFMPEG_NICE, VIDEO_TRANSCODING_FPS } from '../initializers/constants'
import { processImage } from './image-utils'
import { logger } from './logger'
import { checkFFmpegEncoders } from '../initializers/checker-before-init'
import { readFile, remove, writeFile } from 'fs-extra'
import { CONFIG } from '../initializers/config'
import { VideoFileMetadata } from '@shared/models/videos/video-file-metadata'

/**
 * A toolbox to play with audio
 */
namespace audio {
  export const get = (videoPath: string) => {
    // without position, ffprobe considers the last input only
    // we make it consider the first input only
    // if you pass a file path to pos, then ffprobe acts on that file directly
    return new Promise<{ absolutePath: string, audioStream?: any }>((res, rej) => {

      function parseFfprobe (err: any, data: ffmpeg.FfprobeData) {
        if (err) return rej(err)

        if ('streams' in data) {
          const audioStream = data.streams.find(stream => stream['codec_type'] === 'audio')
          if (audioStream) {
            return res({
              absolutePath: data.format.filename,
              audioStream
            })
          }
        }

        return res({ absolutePath: data.format.filename })
      }

      return ffmpeg.ffprobe(videoPath, parseFfprobe)
    })
  }

  export namespace bitrate {
    const baseKbitrate = 384

    const toBits = (kbits: number) => kbits * 8000

    export const aac = (bitrate: number): number => {
      switch (true) {
        case bitrate > toBits(baseKbitrate):
          return baseKbitrate

        default:
          return -1 // we interpret it as a signal to copy the audio stream as is
      }
    }

    export const mp3 = (bitrate: number): number => {
      /*
      a 192kbit/sec mp3 doesn't hold as much information as a 192kbit/sec aac.
      That's why, when using aac, we can go to lower kbit/sec. The equivalences
      made here are not made to be accurate, especially with good mp3 encoders.
      */
      switch (true) {
        case bitrate <= toBits(192):
          return 128

        case bitrate <= toBits(384):
          return 256

        default:
          return baseKbitrate
      }
    }
  }
}

function computeResolutionsToTranscode (videoFileResolution: number) {
  const resolutionsEnabled: number[] = []
  const configResolutions = CONFIG.TRANSCODING.RESOLUTIONS

  // Put in the order we want to proceed jobs
  const resolutions = [
    VideoResolution.H_NOVIDEO,
    VideoResolution.H_480P,
    VideoResolution.H_360P,
    VideoResolution.H_720P,
    VideoResolution.H_240P,
    VideoResolution.H_1080P,
    VideoResolution.H_4K
  ]

  for (const resolution of resolutions) {
    if (configResolutions[resolution + 'p'] === true && videoFileResolution > resolution) {
      resolutionsEnabled.push(resolution)
    }
  }

  return resolutionsEnabled
}

async function getVideoStreamSize (path: string) {
  const videoStream = await getVideoStreamFromFile(path)

  return videoStream === null
    ? { width: 0, height: 0 }
    : { width: videoStream.width, height: videoStream.height }
}

async function getVideoStreamCodec (path: string) {
  const videoStream = await getVideoStreamFromFile(path)

  if (!videoStream) return ''

  const videoCodec = videoStream.codec_tag_string

  const baseProfileMatrix = {
    High: '6400',
    Main: '4D40',
    Baseline: '42E0'
  }

  let baseProfile = baseProfileMatrix[videoStream.profile]
  if (!baseProfile) {
    logger.warn('Cannot get video profile codec of %s.', path, { videoStream })
    baseProfile = baseProfileMatrix['High'] // Fallback
  }

  let level = videoStream.level.toString(16)
  if (level.length === 1) level = `0${level}`

  return `${videoCodec}.${baseProfile}${level}`
}

async function getAudioStreamCodec (path: string) {
  const { audioStream } = await audio.get(path)

  if (!audioStream) return ''

  const audioCodec = audioStream.codec_name
  if (audioCodec === 'aac') return 'mp4a.40.2'

  logger.warn('Cannot get audio codec of %s.', path, { audioStream })

  return 'mp4a.40.2' // Fallback
}

async function getVideoFileResolution (path: string) {
  const size = await getVideoStreamSize(path)

  return {
    videoFileResolution: Math.min(size.height, size.width),
    isPortraitMode: size.height > size.width
  }
}

async function getVideoFileFPS (path: string) {
  const videoStream = await getVideoStreamFromFile(path)
  if (videoStream === null) return 0

  for (const key of [ 'avg_frame_rate', 'r_frame_rate' ]) {
    const valuesText: string = videoStream[key]
    if (!valuesText) continue

    const [ frames, seconds ] = valuesText.split('/')
    if (!frames || !seconds) continue

    const result = parseInt(frames, 10) / parseInt(seconds, 10)
    if (result > 0) return Math.round(result)
  }

  return 0
}

async function getMetadataFromFile <T> (path: string, cb = metadata => metadata) {
  return new Promise<T>((res, rej) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return rej(err)

      return res(cb(new VideoFileMetadata(metadata)))
    })
  })
}

async function getVideoFileBitrate (path: string) {
  return getMetadataFromFile<number>(path, metadata => metadata.format.bit_rate)
}

function getDurationFromVideoFile (path: string) {
  return getMetadataFromFile<number>(path, metadata => Math.floor(metadata.format.duration))
}

function getVideoStreamFromFile (path: string) {
  return getMetadataFromFile<any>(path, metadata => metadata.streams.find(s => s.codec_type === 'video') || null)
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

type TranscodeOptionsType = 'hls' | 'quick-transcode' | 'video' | 'merge-audio' | 'only-audio'

interface BaseTranscodeOptions {
  type: TranscodeOptionsType
  inputPath: string
  outputPath: string
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

function transcode (options: TranscodeOptions) {
  return new Promise<void>(async (res, rej) => {
    try {
      let command = ffmpeg(options.inputPath, { niceness: FFMPEG_NICE.TRANSCODING })
        .output(options.outputPath)

      if (options.type === 'quick-transcode') {
        command = buildQuickTranscodeCommand(command)
      } else if (options.type === 'hls') {
        command = await buildHLSCommand(command, options)
      } else if (options.type === 'merge-audio') {
        command = await buildAudioMergeCommand(command, options)
      } else if (options.type === 'only-audio') {
        command = buildOnlyAudioCommand(command, options)
      } else {
        command = await buildx264Command(command, options)
      }

      if (CONFIG.TRANSCODING.THREADS > 0) {
        // if we don't set any threads ffmpeg will chose automatically
        command = command.outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
      }

      command
        .on('error', (err, stdout, stderr) => {
          logger.error('Error in transcoding job.', { stdout, stderr })
          return rej(err)
        })
        .on('end', () => {
          return fixHLSPlaylistIfNeeded(options)
            .then(() => res())
            .catch(err => rej(err))
        })
        .run()
    } catch (err) {
      return rej(err)
    }
  })
}

async function canDoQuickTranscode (path: string): Promise<boolean> {
  // NOTE: This could be optimized by running ffprobe only once (but it runs fast anyway)
  const videoStream = await getVideoStreamFromFile(path)
  const parsedAudio = await audio.get(path)
  const fps = await getVideoFileFPS(path)
  const bitRate = await getVideoFileBitrate(path)
  const resolution = await getVideoFileResolution(path)

  // check video params
  if (videoStream == null) return false
  if (videoStream['codec_name'] !== 'h264') return false
  if (videoStream['pix_fmt'] !== 'yuv420p') return false
  if (fps < VIDEO_TRANSCODING_FPS.MIN || fps > VIDEO_TRANSCODING_FPS.MAX) return false
  if (bitRate > getMaxBitrate(resolution.videoFileResolution, fps, VIDEO_TRANSCODING_FPS)) return false

  // check audio params (if audio stream exists)
  if (parsedAudio.audioStream) {
    if (parsedAudio.audioStream['codec_name'] !== 'aac') return false

    const maxAudioBitrate = audio.bitrate['aac'](parsedAudio.audioStream['bit_rate'])
    if (maxAudioBitrate !== -1 && parsedAudio.audioStream['bit_rate'] > maxAudioBitrate) return false
  }

  return true
}

function getClosestFramerateStandard (fps: number, type: 'HD_STANDARD' | 'STANDARD'): number {
  return VIDEO_TRANSCODING_FPS[type].slice(0)
                                    .sort((a, b) => fps % a - fps % b)[0]
}

function convertWebPToJPG (path: string, destination: string): Promise<void> {
  return new Promise<void>(async (res, rej) => {
    try {
      const command = ffmpeg(path).output(destination)

      command.on('error', (err, stdout, stderr) => {
        logger.error('Error in ffmpeg webp convert process.', { stdout, stderr })
        return rej(err)
      })
      .on('end', () => res())
      .run()
    } catch (err) {
      return rej(err)
    }
  })
}

// ---------------------------------------------------------------------------

export {
  getVideoStreamCodec,
  getAudioStreamCodec,
  convertWebPToJPG,
  getVideoStreamSize,
  getVideoFileResolution,
  getMetadataFromFile,
  getDurationFromVideoFile,
  generateImageFromVideoFile,
  TranscodeOptions,
  TranscodeOptionsType,
  transcode,
  getVideoFileFPS,
  computeResolutionsToTranscode,
  audio,
  getVideoFileBitrate,
  canDoQuickTranscode
}

// ---------------------------------------------------------------------------

async function buildx264Command (command: ffmpeg.FfmpegCommand, options: TranscodeOptions) {
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

  command = await presetH264(command, options.inputPath, options.resolution, fps)

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

  command = await presetH264VeryFast(command, options.audioPath, options.resolution)

  command = command.input(options.audioPath)
                   .videoFilter('scale=trunc(iw/2)*2:trunc(ih/2)*2') // Avoid "height not divisible by 2" error
                   .outputOption('-tune stillimage')
                   .outputOption('-shortest')

  return command
}

function buildOnlyAudioCommand (command: ffmpeg.FfmpegCommand, options: OnlyAudioTranscodeOptions) {
  command = presetOnlyAudio(command)

  return command
}

function buildQuickTranscodeCommand (command: ffmpeg.FfmpegCommand) {
  command = presetCopy(command)

  command = command.outputOption('-map_metadata -1') // strip all metadata
                   .outputOption('-movflags faststart')

  return command
}

async function buildHLSCommand (command: ffmpeg.FfmpegCommand, options: HLSTranscodeOptions) {
  const videoPath = getHLSVideoPath(options)

  if (options.copyCodecs) command = presetCopy(command)
  else if (options.resolution === VideoResolution.H_NOVIDEO) command = presetOnlyAudio(command)
  else command = await buildx264Command(command, options)

  command = command.outputOption('-hls_time 4')
                   .outputOption('-hls_list_size 0')
                   .outputOption('-hls_playlist_type vod')
                   .outputOption('-hls_segment_filename ' + videoPath)
                   .outputOption('-hls_segment_type fmp4')
                   .outputOption('-f hls')
                   .outputOption('-hls_flags single_file')

  return command
}

function getHLSVideoPath (options: HLSTranscodeOptions) {
  return `${dirname(options.outputPath)}/${options.hlsPlaylist.videoFilename}`
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

/**
 * A slightly customised version of the 'veryfast' x264 preset
 *
 * The veryfast preset is right in the sweet spot of performance
 * and quality. Superfast and ultrafast will give you better
 * performance, but then quality is noticeably worse.
 */
async function presetH264VeryFast (command: ffmpeg.FfmpegCommand, input: string, resolution: VideoResolution, fps?: number) {
  let localCommand = await presetH264(command, input, resolution, fps)

  localCommand = localCommand.outputOption('-preset:v veryfast')

  /*
  MAIN reference: https://slhck.info/video/2017/03/01/rate-control.html
  Our target situation is closer to a livestream than a stream,
  since we want to reduce as much a possible the encoding burden,
  although not to the point of a livestream where there is a hard
  constraint on the frames per second to be encoded.
  */

  return localCommand
}

/**
 * Standard profile, with variable bitrate audio and faststart.
 *
 * As for the audio, quality '5' is the highest and ensures 96-112kbps/channel
 * See https://trac.ffmpeg.org/wiki/Encode/AAC#fdk_vbr
 */
async function presetH264 (command: ffmpeg.FfmpegCommand, input: string, resolution: VideoResolution, fps?: number) {
  let localCommand = command
    .format('mp4')
    .videoCodec('libx264')
    .outputOption('-level 3.1') // 3.1 is the minimal resource allocation for our highest supported resolution
    .outputOption('-b_strategy 1') // NOTE: b-strategy 1 - heuristic algorithm, 16 is optimal B-frames for it
    .outputOption('-bf 16') // NOTE: Why 16: https://github.com/Chocobozzz/PeerTube/pull/774. b-strategy 2 -> B-frames<16
    .outputOption('-pix_fmt yuv420p') // allows import of source material with incompatible pixel formats (e.g. MJPEG video)
    .outputOption('-map_metadata -1') // strip all metadata
    .outputOption('-movflags faststart')

  const parsedAudio = await audio.get(input)

  if (!parsedAudio.audioStream) {
    localCommand = localCommand.noAudio()
  } else if ((await checkFFmpegEncoders()).get('libfdk_aac')) { // we favor VBR, if a good AAC encoder is available
    localCommand = localCommand
      .audioCodec('libfdk_aac')
      .audioQuality(5)
  } else {
    // we try to reduce the ceiling bitrate by making rough matches of bitrates
    // of course this is far from perfect, but it might save some space in the end
    localCommand = localCommand.audioCodec('aac')

    const audioCodecName = parsedAudio.audioStream['codec_name']

    if (audio.bitrate[audioCodecName]) {
      const bitrate = audio.bitrate[audioCodecName](parsedAudio.audioStream['bit_rate'])
      if (bitrate !== undefined && bitrate !== -1) localCommand = localCommand.audioBitrate(bitrate)
    }
  }

  if (fps) {
    // Constrained Encoding (VBV)
    // https://slhck.info/video/2017/03/01/rate-control.html
    // https://trac.ffmpeg.org/wiki/Limiting%20the%20output%20bitrate
    const targetBitrate = getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS)
    localCommand = localCommand.outputOptions([ `-maxrate ${targetBitrate}`, `-bufsize ${targetBitrate * 2}` ])

    // Keyframe interval of 2 seconds for faster seeking and resolution switching.
    // https://streaminglearningcenter.com/blogs/whats-the-right-keyframe-interval.html
    // https://superuser.com/a/908325
    localCommand = localCommand.outputOption(`-g ${fps * 2}`)
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
