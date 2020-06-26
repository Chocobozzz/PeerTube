
import { VideoConstant, VideoFileMetadata, VideoResolution } from '@shared/models'

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
