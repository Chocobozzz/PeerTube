import { VideoCreateUpdateCommon } from '../video-create-update-common.model.js'

export interface VideoImportCreate extends VideoCreateUpdateCommon {
  targetUrl?: string
  magnetUri?: string
  torrentfile?: Blob

  // Default is true if the feature is enabled by the instance admin
  generateTranscription?: boolean

  channelId: number // Required
}
