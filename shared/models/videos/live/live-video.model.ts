import { LiveVideoLatencyMode } from './live-video-latency-mode.enum'

export interface LiveVideo {
  // If owner
  rtmpUrl?: string
  rtmpsUrl?: string
  streamKey?: string

  saveReplay: boolean
  permanentLive: boolean
  latencyMode: LiveVideoLatencyMode
}
