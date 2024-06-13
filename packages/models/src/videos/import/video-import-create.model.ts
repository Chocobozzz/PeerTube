import { VideoUpdate } from '../video-update.model.js'

export interface VideoImportCreate extends VideoUpdate {
  targetUrl?: string
  magnetUri?: string
  torrentfile?: Blob

  // Default is true if the feature is enabled by the instance admin
  generateTranscription?: boolean

  channelId: number // Required
}
