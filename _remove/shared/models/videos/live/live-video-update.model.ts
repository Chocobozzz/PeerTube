import { LiveVideoLatencyMode } from './live-video-latency-mode.enum'

export interface LiveVideoUpdate {
  permanentLive?: boolean
  saveReplay?: boolean
  latencyMode?: LiveVideoLatencyMode
}
