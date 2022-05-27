import { LiveVideoError } from './live-video-error.enum'

export interface LiveVideoSession {
  id: number

  startDate: string
  endDate: string

  error: LiveVideoError

  replayVideo: {
    id: number
    uuid: string
    shortUUID: string
  }
}
