import { Video } from './video.model'
import { VideoConstant } from './video-constant.model'
import { VideoImportState } from '../../index'

export interface VideoImport {
  targetUrl: string
  createdAt: string
  updatedAt: string
  state: VideoConstant<VideoImportState>

  video?: Video & { tags: string[] }
}
