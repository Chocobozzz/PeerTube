import { Video } from './video.model'

export interface VideoImport {
  targetUrl: string

  video: Video & { tags: string[] }
}
