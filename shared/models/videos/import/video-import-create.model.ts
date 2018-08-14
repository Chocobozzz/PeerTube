import { VideoUpdate } from '../video-update.model'

export interface VideoImportCreate extends VideoUpdate {
  targetUrl?: string
  magnetUri?: string
  torrentfile?: Blob

  channelId: number // Required
}
