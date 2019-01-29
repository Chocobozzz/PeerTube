import * as ffmpeg from 'fluent-ffmpeg'
import { dirname, join } from 'path'
import { getTargetBitrate, VideoResolution } from '../../shared/models/videos'
import { CONFIG, FFMPEG_NICE, VIDEO_TRANSCODING_FPS } from '../initializers/constants'
import { processImage } from './image-utils'
import { logger } from './logger'
import { checkFFmpegEncoders } from '../initializers/checker-before-init'
import { remove } from 'fs-extra'

function computeResolutionsToTranscode (videoFileHeight: number) {
  const resolutionsEnabled: number[] = []
  const configResolutions = CONFIG.TRANSCODING.RESOLUTIONS

  // Put in the order we want to proceed jobs
  const resolutions = [
    VideoResolution.H_480P,
    VideoResolution.H_360P,
    VideoResolution.H_720P,
    VideoResolution.H_240P,
    VideoResolution.H_1080P
  ]

  for (const resolution of resolutions) {
    if (configResolutions[ resolution + 'p' ] === true && videoFileHeight > resolution) {
      resolutionsEnabled.push(resolution)
    }
  }

  return resolutionsEnabled
}

async function getVideoFileSize (path: string) {
  const videoStream = await getVideoFileStream(path)

  return {
    width: videoStream.width,
    height: videoStream.height
  }
}

async function getVideoFileResolution (path: string) {
  const size = await getVideoFileSize(path)

  return {
    videoFileResolution: Math.min(size.height, size.width),
    isPortraitMode: size.height > size.width
  }
}

async function getVideoFileFPS (path: string) {
  const videoStream = await getVideoFileStream(path)

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

async function getVideoFileBitrate (path: string) {
  return new Promise<number>((res, rej) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return rej(err)

      return res(metadata.format.bit_rate)
    })
  })
}

function getDurationFromVideoFile (path: string) {
  return new Promise<number>((res, rej) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return rej(err)

      return res(Math.floor(metadata.format.duration))
    })
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
    await processImage({ path: pendingImagePath }, destination, size)
  } catch (err) {
    logger.error('Cannot generate image from video %s.', fromPath, { err })

    try {
      await remove(pendingImagePath)
    } catch (err) {
      logger.debug('Cannot remove pending image path after generation error.', { err })
    }
  }
}

type TranscodeOptions = {
  inputPath: string
  outputPath: string
  resolution: VideoResolution
  isPortraitMode?: boolean

  generateHlsPlaylist?: boolean
}

function transcode (options: TranscodeOptions) {
  return new Promise<void>(async (res, rej) => {
    try {
      let fps = await getVideoFileFPS(options.inputPath)
      // On small/medium resolutions, limit FPS
      if (
        options.resolution !== undefined &&
        options.resolution < VIDEO_TRANSCODING_FPS.KEEP_ORIGIN_FPS_RESOLUTION_MIN &&
        fps > VIDEO_TRANSCODING_FPS.AVERAGE
      ) {
        fps = VIDEO_TRANSCODING_FPS.AVERAGE
      }

      let command = ffmpeg(options.inputPath, { niceness: FFMPEG_NICE.TRANSCODING })
        .output(options.outputPath)
      command = await presetH264(command, options.resolution, fps)

      if (CONFIG.TRANSCODING.THREADS > 0) {
        // if we don't set any threads ffmpeg will chose automatically
        command = command.outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
      }

      if (options.resolution !== undefined) {
        // '?x720' or '720x?' for example
        const size = options.isPortraitMode === true ? `${options.resolution}x?` : `?x${options.resolution}`
        command = command.size(size)
      }

      if (fps) {
        // Hard FPS limits
        if (fps > VIDEO_TRANSCODING_FPS.MAX) fps = VIDEO_TRANSCODING_FPS.MAX
        else if (fps < VIDEO_TRANSCODING_FPS.MIN) fps = VIDEO_TRANSCODING_FPS.MIN

        command = command.withFPS(fps)
      }

      if (options.generateHlsPlaylist) {
        const segmentFilename = `${dirname(options.outputPath)}/${options.resolution}_%03d.ts`

        command = command.outputOption('-hls_time 4')
                         .outputOption('-hls_list_size 0')
                         .outputOption('-hls_playlist_type vod')
                         .outputOption('-hls_segment_filename ' + segmentFilename)
                         .outputOption('-f hls')
      }

      command
        .on('error', (err, stdout, stderr) => {
          logger.error('Error in transcoding job.', { stdout, stderr })
          return rej(err)
        })
        .on('end', res)
        .run()
    } catch (err) {
      return rej(err)
    }
  })
}

// ---------------------------------------------------------------------------

export {
  getVideoFileSize,
  getVideoFileResolution,
  getDurationFromVideoFile,
  generateImageFromVideoFile,
  transcode,
  getVideoFileFPS,
  computeResolutionsToTranscode,
  audio,
  getVideoFileBitrate
}

// ---------------------------------------------------------------------------

function getVideoFileStream (path: string) {
  return new Promise<any>((res, rej) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return rej(err)

      const videoStream = metadata.streams.find(s => s.codec_type === 'video')
      if (!videoStream) return rej(new Error('Cannot find video stream of ' + path))

      return res(videoStream)
    })
  })
}

/**
 * A slightly customised version of the 'veryfast' x264 preset
 *
 * The veryfast preset is right in the sweet spot of performance
 * and quality. Superfast and ultrafast will give you better
 * performance, but then quality is noticeably worse.
 */
async function presetH264VeryFast (command: ffmpeg.FfmpegCommand, resolution: VideoResolution, fps: number): Promise<ffmpeg.FfmpegCommand> {
  let localCommand = await presetH264(command, resolution, fps)
  localCommand = localCommand.outputOption('-preset:v veryfast')
             .outputOption([ '--aq-mode=2', '--aq-strength=1.3' ])
  /*
  MAIN reference: https://slhck.info/video/2017/03/01/rate-control.html
  Our target situation is closer to a livestream than a stream,
  since we want to reduce as much a possible the encoding burden,
  altough not to the point of a livestream where there is a hard
  constraint on the frames per second to be encoded.

  why '--aq-mode=2 --aq-strength=1.3' instead of '-profile:v main'?
    Make up for most of the loss of grain and macroblocking
    with less computing power.
  */

  return localCommand
}

/**
 * A preset optimised for a stillimage audio video
 */
async function presetStillImageWithAudio (
  command: ffmpeg.FfmpegCommand,
  resolution: VideoResolution,
  fps: number
): Promise<ffmpeg.FfmpegCommand> {
  let localCommand = await presetH264VeryFast(command, resolution, fps)
  localCommand = localCommand.outputOption('-tune stillimage')

  return localCommand
}

/**
 * A toolbox to play with audio
 */
namespace audio {
  export const get = (option: ffmpeg.FfmpegCommand | string) => {
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

      if (typeof option === 'string') {
        return ffmpeg.ffprobe(option, parseFfprobe)
      }

      return option.ffprobe(parseFfprobe)
    })
  }

  export namespace bitrate {
    const baseKbitrate = 384

    const toBits = (kbits: number): number => { return kbits * 8000 }

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

/**
 * Standard profile, with variable bitrate audio and faststart.
 *
 * As for the audio, quality '5' is the highest and ensures 96-112kbps/channel
 * See https://trac.ffmpeg.org/wiki/Encode/AAC#fdk_vbr
 */
async function presetH264 (command: ffmpeg.FfmpegCommand, resolution: VideoResolution, fps: number): Promise<ffmpeg.FfmpegCommand> {
  let localCommand = command
    .format('mp4')
    .videoCodec('libx264')
    .outputOption('-level 3.1') // 3.1 is the minimal ressource allocation for our highest supported resolution
    .outputOption('-b_strategy 1') // NOTE: b-strategy 1 - heuristic algorythm, 16 is optimal B-frames for it
    .outputOption('-bf 16') // NOTE: Why 16: https://github.com/Chocobozzz/PeerTube/pull/774. b-strategy 2 -> B-frames<16
    .outputOption('-pix_fmt yuv420p') // allows import of source material with incompatible pixel formats (e.g. MJPEG video)
    .outputOption('-map_metadata -1') // strip all metadata
    .outputOption('-movflags faststart')

  const parsedAudio = await audio.get(localCommand)

  if (!parsedAudio.audioStream) {
    localCommand = localCommand.noAudio()
  } else if ((await checkFFmpegEncoders()).get('libfdk_aac')) { // we favor VBR, if a good AAC encoder is available
    localCommand = localCommand
      .audioCodec('libfdk_aac')
      .audioQuality(5)
  } else {
    // we try to reduce the ceiling bitrate by making rough correspondances of bitrates
    // of course this is far from perfect, but it might save some space in the end
    const audioCodecName = parsedAudio.audioStream[ 'codec_name' ]
    let bitrate: number
    if (audio.bitrate[ audioCodecName ]) {
      localCommand = localCommand.audioCodec('aac')

      bitrate = audio.bitrate[ audioCodecName ](parsedAudio.audioStream[ 'bit_rate' ])
      if (bitrate !== undefined && bitrate !== -1) localCommand = localCommand.audioBitrate(bitrate)
    }
  }

  // Constrained Encoding (VBV)
  // https://slhck.info/video/2017/03/01/rate-control.html
  // https://trac.ffmpeg.org/wiki/Limiting%20the%20output%20bitrate
  const targetBitrate = getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS)
  localCommand = localCommand.outputOptions([`-maxrate ${ targetBitrate }`, `-bufsize ${ targetBitrate * 2 }`])

  // Keyframe interval of 2 seconds for faster seeking and resolution switching.
  // https://streaminglearningcenter.com/blogs/whats-the-right-keyframe-interval.html
  // https://superuser.com/a/908325
  localCommand = localCommand.outputOption(`-g ${ fps * 2 }`)

  return localCommand
}
