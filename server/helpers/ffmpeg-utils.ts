import * as ffmpeg from 'fluent-ffmpeg'

import { CONFIG } from '../initializers'
import { VideoResolution } from '../../shared/models/videos/video-resolution.enum'

function getVideoFileHeight (path: string) {
  return new Promise<number>((res, rej) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return rej(err)

      const videoStream = metadata.streams.find(s => s.codec_type === 'video')
      return res(videoStream.height)
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

function generateImageFromVideoFile (fromPath: string, folder: string, imageName: string, size: string) {
  const options = {
    filename: imageName,
    count: 1,
    folder
  }

  if (size !== undefined) {
    options['size'] = size
  }

  return new Promise<string>((res, rej) => {
    ffmpeg(fromPath)
      .on('error', rej)
      .on('end', () => res(imageName))
      .thumbnail(options)
  })
}

type TranscodeOptions = {
  inputPath: string
  outputPath: string
  resolution?: VideoResolution
}

function transcode (options: TranscodeOptions) {
  return new Promise<void>((res, rej) => {
    let command = ffmpeg(options.inputPath)
                    .output(options.outputPath)
                    .videoCodec('libx264')
                    .outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
                    .outputOption('-movflags faststart')
                    // .outputOption('-crf 18')

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
  transcode
}
