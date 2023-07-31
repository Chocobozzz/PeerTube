import { VideoPrivacyType } from '../video-privacy.enum.js'
import { LiveVideoErrorType } from './live-video-error.enum.js'

export interface LiveVideoSession {
  id: number

  startDate: string
  endDate: string

  error: LiveVideoErrorType

  saveReplay: boolean
  endingProcessed: boolean

  replaySettings?: { privacy: VideoPrivacyType }

  replayVideo: {
    id: number
    uuid: string
    shortUUID: string
  }
}
