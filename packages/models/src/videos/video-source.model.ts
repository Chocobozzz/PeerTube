import { VideoFileMetadata } from './file/index.js'
import { ConstantLabel } from '../common/constant-label.model.js'

export interface VideoSource {
  inputFilename: string

  resolution?: ConstantLabel<number>
  size?: number // Bytes

  width?: number
  height?: number

  fileDownloadUrl: string

  fps?: number

  metadata?: VideoFileMetadata

  createdAt: string | Date
}
