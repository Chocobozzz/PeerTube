import { VideoConstant, VideoResolution } from '@shared/models'
import { FfprobeData } from 'fluent-ffmpeg'

export interface VideoFile {
  magnetUri: string
  resolution: VideoConstant<VideoResolution>
  size: number // Bytes
  torrentUrl: string
  torrentDownloadUrl: string
  fileUrl: string
  fileDownloadUrl: string
  fps: number
  metadata?: FfprobeData
  metadataUrl?: string
}
