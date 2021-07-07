import { VideoState } from '../video-state.enum'

export interface LiveVideoEventPayload {
  state?: VideoState
  views?: number
}
