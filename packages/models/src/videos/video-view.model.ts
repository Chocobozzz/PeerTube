export type VideoViewEvent = 'seek'

export interface VideoView {
  currentTime: number
  viewEvent?: VideoViewEvent
  sessionId?: string
}
