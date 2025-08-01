import { VideoPrivacyType } from '../video-privacy.enum.js'
import { LiveVideoLatencyModeType } from './live-video-latency-mode.enum.js'
import { LiveVideoScheduleEdit } from './live-video-schedule.model.js'

export interface LiveVideoUpdate {
  permanentLive?: boolean
  saveReplay?: boolean
  replaySettings?: { privacy: VideoPrivacyType }
  latencyMode?: LiveVideoLatencyModeType

  schedules?: LiveVideoScheduleEdit[]
}
