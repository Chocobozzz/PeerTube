import * as ffmpeg from 'fluent-ffmpeg'
import { VideoResolution } from '../../shared/models/videos'
import { CONFIG, MAX_VIDEO_TRANSCODING_FPS } from '../initializers'
import { processImage } from './image-utils'
import { join } from 'path'

async function getVideoFileHeight (path: string) {
  const videoStream = await getVideoFileStream(path)
  return videoStream.height
}

async function getVideoFileFPS (path: string) {
  const videoStream = await getVideoFileStream(path)

  for (const key of [ 'r_frame_rate' , 'avg_frame_rate' ]) {
    const valuesText: string = videoStream[key]
    if (!valuesText) continue

    const [ frames, seconds ] = valuesText.split('/')
    if (!frames || !seconds) continue

    const result = parseInt(frames, 10) / parseInt(seconds, 10)
    if (result > 0) return result
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

  await new Promise<string>((res, rej) => {
    ffmpeg(fromPath)
      .on('error', rej)
      .on('end', () => res(imageName))
      .thumbnail(options)
  })

  const pendingImagePath = join(folder, pendingImageName)
  const destination = join(folder, imageName)
  await processImage({ path: pendingImagePath }, destination, size)
}

type TranscodeOptions = {
  inputPath: string
  outputPath: string
  resolution?: VideoResolution
}

function transcode (options: TranscodeOptions) {
  return new Promise<void>(async (res, rej) => {
    const fps = await getVideoFileFPS(options.inputPath)

    let command = ffmpeg(options.inputPath)
                    .output(options.outputPath)
                    .videoCodec('libx264')
                    .outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
                    .outputOption('-movflags faststart')
                    // .outputOption('-crf 18')

    if (fps > MAX_VIDEO_TRANSCODING_FPS) command = command.withFPS(MAX_VIDEO_TRANSCODING_FPS)

    if (options.resolution !== undefined) {
      const size = `?x${options.resolution}` // '?x720' for example
      command = command.size(size)
    }

    command.on('error', rej)
           .on('end', res)
           .run()
  })
}

// ---------------------------------------------------------------------------

export {
  getVideoFileHeight,
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
