import * as ffmpeg from 'fluent-ffmpeg'
import { join } from 'path'
import { VideoResolution } from '../../shared/models/videos'
import { CONFIG, VIDEO_TRANSCODING_FPS } from '../initializers'
import { unlinkPromise } from './core-utils'
import { processImage } from './image-utils'
import { logger } from './logger'
import { checkFFmpegEncoders } from '../initializers/checker'

async function getVideoFileResolution (path: string) {
  const videoStream = await getVideoFileStream(path)

  return {
    videoFileResolution: Math.min(videoStream.height, videoStream.width),
    isPortraitMode: videoStream.height > videoStream.width
  }
}

async function getVideoFileFPS (path: string) {
  const videoStream = await getVideoFileStream(path)

  for (const key of [ 'r_frame_rate' , 'avg_frame_rate' ]) {
    const valuesText: string = videoStream[key]
    if (!valuesText) continue

    const [ frames, seconds ] = valuesText.split('/')
    if (!frames || !seconds) continue

    const result = parseInt(frames, 10) / parseInt(seconds, 10)
    if (result > 0) return Math.round(result)
  }

  return 0
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
      ffmpeg(fromPath)
        .on('error', rej)
        .on('end', () => res(imageName))
        .thumbnail(options)
    })

    const destination = join(folder, imageName)
    await processImage({ path: pendingImagePath }, destination, size)
  } catch (err) {
    logger.error('Cannot generate image from video %s.', fromPath, { err })

    try {
      await unlinkPromise(pendingImagePath)
    } catch (err) {
      logger.debug('Cannot remove pending image path after generation error.', { err })
    }
  }
}

type TranscodeOptions = {
  inputPath: string
  outputPath: string
  resolution?: VideoResolution
  isPortraitMode?: boolean
}

function transcode (options: TranscodeOptions) {
  return new Promise<void>(async (res, rej) => {
    let command = ffmpeg(options.inputPath)
                    .output(options.outputPath)
                    .outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
                    .preset(standard)

    let fps = await getVideoFileFPS(options.inputPath)
    if (options.resolution !== undefined) {
      // '?x720' or '720x?' for example
      const size = options.isPortraitMode === true ? `${options.resolution}x?` : `?x${options.resolution}`
      command = command.size(size)

      // On small/medium resolutions, limit FPS
      if (
        options.resolution < VIDEO_TRANSCODING_FPS.KEEP_ORIGIN_FPS_RESOLUTION_MIN &&
        fps > VIDEO_TRANSCODING_FPS.AVERAGE
      ) {
        fps = VIDEO_TRANSCODING_FPS.AVERAGE
      }
    }

    if (fps) {
      // Hard FPS limits
      if (fps > VIDEO_TRANSCODING_FPS.MAX) fps = VIDEO_TRANSCODING_FPS.MAX
      else if (fps < VIDEO_TRANSCODING_FPS.MIN) fps = VIDEO_TRANSCODING_FPS.MIN

      command = command.withFPS(fps)
    }

    command
      .on('error', (err, stdout, stderr) => {
        logger.error('Error in transcoding job.', { stdout, stderr })
        return rej(err)
      })
      .on('end', res)
      .run()
  })
}

// ---------------------------------------------------------------------------

export {
  getVideoFileResolution,
  getDurationFromVideoFile,
  generateImageFromVideoFile,
  transcode,
  getVideoFileFPS
}

// ---------------------------------------------------------------------------

function getVideoFileStream (path: string) {
  return new Promise<any>((res, rej) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return rej(err)

      const videoStream = metadata.streams.find(s => s.codec_type === 'video')
      if (!videoStream) throw new Error('Cannot find video stream of ' + path)

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
function veryfast (ffmpeg) {
  ffmpeg
    .preset(standard)
    .outputOption('-preset:v veryfast')
    .outputOption(['--aq-mode=2', '--aq-strength=1.3'])
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
}

/**
 * A preset optimised for a stillimage audio video
 */
function audio (ffmpeg) {
  ffmpeg
    .preset(veryfast)
    .outputOption('-tune stillimage')
}

/**
 * A toolbox to play with audio
 */
namespace audio {
  export const get = (ffmpeg, pos = 0) => {
    // without position, ffprobe considers the last input only
    // we make it consider the first input only
    ffmpeg
      .ffprobe(pos, (_,data) => {
        return data['streams'].find(stream => {
          return stream['codec_type'] === 'audio'
        })
      })
  }

  export namespace bitrate {
    export const baseKbitrate = 384

    const toBits = (kbits: number): number => { return kbits * 8000 }

    export const aac = (bitrate: number): number => {
      switch (true) {
      case bitrate > toBits(384):
        return baseKbitrate
      default:
        return -1 // we interpret it as a signal to copy the audio stream as is
      }
    }

    export const mp3 = (bitrate: number): number => {
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
async function standard (ffmpeg) {
  let _bitrate = audio.bitrate.baseKbitrate
  let _ffmpeg = ffmpeg
    .format('mp4')
    .videoCodec('libx264')
    .outputOption('-level 3.1') // 3.1 is the minimal ressource allocation for our highest supported resolution
    .outputOption('-b_strategy 1') // NOTE: b-strategy 1 - heuristic algorythm, 16 is optimal B-frames for it
    .outputOption('-bf 16') // NOTE: Why 16: https://github.com/Chocobozzz/PeerTube/pull/774. b-strategy 2 -> B-frames<16
    .outputOption('-movflags faststart')
  let _audio = audio.get(_ffmpeg)

  if (!_audio) return _ffmpeg.noAudio()

  // we try to reduce the ceiling bitrate by making rough correspondances of bitrates
  // of course this is far from perfect, but it might save some space in the end
  if (audio.bitrate[_audio['codec_name']]) {
    _bitrate = audio.bitrate[_audio['codec_name']](_audio['bit_rate'])
    if (_bitrate === -1) {
      return _ffmpeg.audioCodec('copy')
    }
  }

  // we favor VBR, if a good AAC encoder is available
  if ((await checkFFmpegEncoders()).get('libfdk_aac')) {
    return _ffmpeg
      .audioCodec('libfdk_aac')
      .audioQuality(5)
  }

  return _ffmpeg.audioBitrate(_bitrate)
}
