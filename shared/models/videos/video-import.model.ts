import { Video } from './video.model'
import { VideoConstant } from './video-constant.model'
import { VideoImportState } from '../../index'

export interface VideoImport {
  id: number
  targetUrl: string
  createdAt: string
  updatedAt: string
  state: VideoConstant<VideoImportState>
  error?: string

  video?: Video & { tags: string[] }
}
