import { VideoFileMetadata } from './file/index.js'
import { VideoConstant } from './video-constant.model.js'

export interface VideoSource {
  inputFilename: string

  resolution?: VideoConstant<number>
  size?: number // Bytes

  width?: number
  height?: number

  fileUrl: string
  fileDownloadUrl: string

  fps?: number

  metadata?: VideoFileMetadata

  createdAt: string | Date
}
