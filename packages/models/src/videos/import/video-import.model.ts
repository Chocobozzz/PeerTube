import { VideoConstant } from '../video-constant.model.js'
import { Video } from '../video.model.js'
import { VideoImportStateType } from './video-import-state.enum.js'

export interface VideoImport {
  id: number

  targetUrl: string
  magnetUri: string
  torrentName: string

  attempts: number

  createdAt: string
  updatedAt: string
  originallyPublishedAt?: string
  state: VideoConstant<VideoImportStateType>
  error?: string

  video?: Video & { tags: string[] }

  videoChannelSync?: {
    id: number
    externalChannelUrl: string
  }
}
