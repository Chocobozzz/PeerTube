import { VideoUpdate } from './video-update.model'

export interface VideoImportUpdate extends VideoUpdate {
  targetUrl: string
}
