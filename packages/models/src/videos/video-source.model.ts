import { VideoFileMetadata } from './file/index.js'
import { VideoConstant } from './video-constant.model.js'

export interface VideoSource {
  inputFilename: string

  resolution?: VideoConstant<number>
  size?: number // Bytes

  width?: number
  height?: number

  fileDownloadUrl: string

  fps?: number

  metadata?: VideoFileMetadata

  createdAt: string | Date
}
