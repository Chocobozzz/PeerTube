export type VideoViewEvent = 'seek'

export interface VideoView {
  currentTime: number
  viewEvent?: VideoViewEvent
  sessionId?: string
  userAgent: UserAgent
}

export interface UserAgent {
  browser: string
  device: string
  operatingSystem: string
}
