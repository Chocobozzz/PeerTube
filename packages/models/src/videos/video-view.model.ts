import { VideoStatsUserAgentDevice } from './stats/video-stats-user-agent.model.js'

export type VideoViewEvent = 'seek'

export interface VideoView {
  currentTime: number
  viewEvent?: VideoViewEvent
  sessionId?: string

  client?: string
  device?: VideoStatsUserAgentDevice
  operatingSystem?: string
}
