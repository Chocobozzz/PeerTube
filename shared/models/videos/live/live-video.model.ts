import { VideoPrivacy } from '../video-privacy.enum'
import { LiveVideoLatencyMode } from './live-video-latency-mode.enum'

export interface LiveVideo {
  // If owner
  rtmpUrl?: string
  rtmpsUrl?: string
  streamKey?: string

  saveReplay: boolean
  replaySettings?: { privacy: VideoPrivacy }
  permanentLive: boolean
  latencyMode: LiveVideoLatencyMode
}
