import { FFmpegImage } from '@peertube/peertube-ffmpeg'
import { getFFmpegCommandWrapperOptions } from './ffmpeg-options.js'

export function generateThumbnailFromVideo (options: Parameters<FFmpegImage['generateThumbnailFromVideo']>[0]) {
  return new FFmpegImage(getFFmpegCommandWrapperOptions('thumbnail')).generateThumbnailFromVideo(options)
}
