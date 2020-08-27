import { VideoConstant } from './video-constant.model'
import { VideoFileMetadata } from './video-file-metadata'
import { VideoResolution } from './video-resolution.enum'

export interface VideoFile {
  magnetUri: string
  resolution: VideoConstant<VideoResolution>
  size: number // Bytes
  torrentUrl: string
  torrentDownloadUrl: string
  fileUrl: string
  fileDownloadUrl: string
  fps: number
  metadata?: VideoFileMetadata
  metadataUrl?: string
}
