import { VideoUpdate } from './video-update.model'

export interface VideoImportCreate extends VideoUpdate {
  targetUrl: string
  channelId: number // Required
}
