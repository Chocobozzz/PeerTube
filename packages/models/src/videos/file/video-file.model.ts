import { FileStorageType } from '../../common/file-storage.enum.js'
import { ConstantLabel } from '../../common/constant-label.model.js'
import { VideoFileMetadata } from './video-file-metadata.model.js'

export interface VideoFile {
  id: number

  resolution: ConstantLabel<number>
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
