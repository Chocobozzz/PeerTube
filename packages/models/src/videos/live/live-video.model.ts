import { VideoPrivacyType } from '../video-privacy.enum.js'
import { LiveVideoLatencyModeType } from './live-video-latency-mode.enum.js'
import { LiveVideoScheduleEdit } from './live-video-schedule.model.js'

export interface LiveVideo {
  // If owner
  rtmpUrl?: string
  rtmpsUrl?: string
  streamKey?: string
  // End if owner

  saveReplay: boolean
  replaySettings?: { privacy: VideoPrivacyType }
  permanentLive: boolean
  latencyMode: LiveVideoLatencyModeType

  schedules: LiveVideoScheduleEdit[]
}
