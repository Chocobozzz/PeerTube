import { FFmpegImage } from '@peertube/peertube-ffmpeg'
import { getFFmpegCommandWrapperOptions } from './ffmpeg-options.js'

export function processGIF (options: Parameters<FFmpegImage['processGIF']>[0]) {
  return new FFmpegImage(getFFmpegCommandWrapperOptions('thumbnail')).processGIF(options)
}

export function generateThumbnailFromVideo (options: Parameters<FFmpegImage['generateThumbnailFromVideo']>[0]) {
  return new FFmpegImage(getFFmpegCommandWrapperOptions('thumbnail')).generateThumbnailFromVideo(options)
}

export function convertWebPToJPG (options: Parameters<FFmpegImage['convertWebPToJPG']>[0]) {
  return new FFmpegImage(getFFmpegCommandWrapperOptions('thumbnail')).convertWebPToJPG(options)
}
