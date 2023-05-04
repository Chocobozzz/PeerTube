import { VideoPrivacy } from '../video-privacy.enum'
import { LiveVideoLatencyMode } from './live-video-latency-mode.enum'

export interface LiveVideoUpdate {
  permanentLive?: boolean
  saveReplay?: boolean
  replaySettings?: { privacy: VideoPrivacy }
  latencyMode?: LiveVideoLatencyMode
}
