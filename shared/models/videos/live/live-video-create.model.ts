import { VideoCreate } from '../video-create.model'
import { VideoPrivacy } from '../video-privacy.enum'
import { LiveVideoLatencyMode } from './live-video-latency-mode.enum'

export interface LiveVideoCreate extends VideoCreate {
  permanentLive?: boolean
  latencyMode?: LiveVideoLatencyMode

  saveReplay?: boolean
  replaySettings?: { privacy: VideoPrivacy }
}
