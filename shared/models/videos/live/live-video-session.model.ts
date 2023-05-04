import { VideoPrivacy } from '../video-privacy.enum'
import { LiveVideoError } from './live-video-error.enum'

export interface LiveVideoSession {
  id: number

  startDate: string
  endDate: string

  error: LiveVideoError

  saveReplay: boolean
  endingProcessed: boolean

  replaySettings?: { privacy: VideoPrivacy }

  replayVideo: {
    id: number
    uuid: string
    shortUUID: string
  }
}
