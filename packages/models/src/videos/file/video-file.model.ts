import { FileStorageType } from '../../common/file-storage.enum.js'
import { VideoConstant } from '../video-constant.model.js'
import { VideoFileMetadata } from './video-file-metadata.model.js'

export interface VideoFile {
  id: number

  resolution: VideoConstant<number>
  size: number // Bytes

  width?: number
  height?: number

  torrentUrl: string
  torrentDownloadUrl: string

  fileUrl: string
  fileDownloadUrl: string

  fps: number

  metadata?: VideoFileMetadata
  metadataUrl?: string

  magnetUri: string | null

  hasAudio: boolean
  hasVideo: boolean

  storage: FileStorageType
}
