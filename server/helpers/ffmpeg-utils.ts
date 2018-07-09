import * as ffmpeg from 'fluent-ffmpeg'
import { join } from 'path'
import { VideoResolution } from '../../shared/models/videos'
import { CONFIG, VIDEO_TRANSCODING_FPS } from '../initializers'
import { unlinkPromise } from './core-utils'
import { processImage } from './image-utils'
import { logger } from './logger'

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
                    .videoCodec('libx264')
                    .outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
                    .outputOption('-movflags faststart')
                    .outputOption('-b_strategy 1') // NOTE: b-strategy 1 - heuristic algorythm, 16 is optimal B-frames for it
                    .outputOption('-bf 16') // NOTE: Why 16: https://github.com/Chocobozzz/PeerTube/pull/774. b-strategy 2 -> B-frames<16
                    // .outputOption('-crf 18')

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
