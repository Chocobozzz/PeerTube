import { VideoStateType } from '../video-state.enum.js'

export interface LiveVideoEventPayload {
  state?: VideoStateType

  viewers?: number
}
