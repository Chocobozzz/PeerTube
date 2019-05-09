import { Video } from '../video.model'
import { VideoConstant } from '../video-constant.model'
import { VideoImportState } from './video-import-state.enum'

export interface VideoImport {
  id: number

  targetUrl: string
  magnetUri: string
  torrentName: string

  createdAt: string
  updatedAt: string
  originallyPublishedAt?: string
  state: VideoConstant<VideoImportState>
  error?: string

  video?: Video & { tags: string[] }
}
