import { VideoState } from '../video-state.enum'

export interface LiveVideoEventPayload {
  state?: VideoState

  // FIXME: deprecated in 4.0 in favour of viewers
  views?: number

  viewers?: number
}
